import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server as SocketIOServer } from 'socket.io';
import { decode } from 'next-auth/jwt';
import { parse as parseCookies } from 'cookie';
// NOTE: initSocketServer is NOT imported here at module level.
// It transitively imports Prisma, which reads DATABASE_URL at construction time.
// Next.js loads .env.local inside app.prepare() — so we must defer this import
// until AFTER prepare() resolves, otherwise Prisma gets DATABASE_URL=undefined.

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || '::';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
  // Don't crash — log and continue (game state stays in memory)
});
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});

app.prepare().then(async () => {
  // Dynamic import AFTER app.prepare() so Next.js has already loaded .env.local
  // before Prisma constructs its connection pool with DATABASE_URL.
  const { initSocketServer } = await import('./lib/socket/socketServer');
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url!, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  // Default to '*' (open) unless ALLOWED_ORIGINS is explicitly set in env
  const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim())
    : ['*'];

  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: (origin, callback) => {
        // Allow requests with no origin (server-to-server, curl, etc.)
        if (!origin || ALLOWED_ORIGINS.includes('*') || ALLOWED_ORIGINS.some(o => origin.startsWith(o))) {
          callback(null, true);
        } else {
          callback(new Error('CORS rejected'));
        }
      },
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    maxHttpBufferSize: 1e6,
  });

  const userIdToSocket = new Map<string, string>();

  // Socket.IO auth middleware — extracts userId from NextAuth JWT cookie
  // Also handles session takeover: kicks existing socket for same userId
  io.use(async (socket, next) => {
    try {
      const cookieHeader = socket.request.headers.cookie || '';
      const cookies = parseCookies(cookieHeader);

      const sessionToken =
        cookies['authjs.session-token'] ||
        cookies['__Secure-authjs.session-token'];

      if (!sessionToken) {
        return next();
      }

      const secret = process.env.AUTH_SECRET;
      if (!secret) return next();

      const token = await decode({
        token: sessionToken,
        secret,
        salt: sessionToken.startsWith('__Secure')
          ? '__Secure-authjs.session-token'
          : 'authjs.session-token',
      });

      if (token?.userId) {
        socket.data.userId = token.userId as string;
        socket.data.displayName = (token.name as string) || '';

        // Session takeover: kick existing socket for this userId
        const existingSocketId = userIdToSocket.get(token.userId as string);
        if (existingSocketId && existingSocketId !== socket.id) {
          const existingSocket = io.sockets.sockets.get(existingSocketId);
          if (existingSocket) {
            existingSocket.emit('session:takeover', {
              message: 'Your session was taken over from another device.',
            });
            existingSocket.disconnect(true);
          }
        }
        userIdToSocket.set(token.userId as string, socket.id);
      }

      next();
    } catch (err) {
      console.error('[socket auth middleware]', err);
      next();
    }
  });

  // Wait for DB to be ready before starting socket server
  const { waitForDb } = await import('./lib/db/prisma');
  await waitForDb();

  const flushRooms = initSocketServer(io, userIdToSocket);

  // Clean up userIdToSocket on disconnect
  io.on('connection', (socket) => {
    socket.on('disconnect', () => {
      if (socket.data.userId) {
        const current = userIdToSocket.get(socket.data.userId);
        if (current === socket.id) {
          userIdToSocket.delete(socket.data.userId);
        }
      }
    });
  });

  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
    console.log(`> Socket.IO server running`);
  });

  // Graceful shutdown — persist all state before exiting
  const shutdown = async (signal: string) => {
    console.log(`\n[${signal}] Shutting down gracefully...`);

    // Notify all connected clients
    io.emit('server:restarting', { message: 'Server is restarting. Your game is saved.' });

    // Allow 2 seconds for clients to receive the notification
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Flush all room state to DB
    console.log('[shutdown] Flushing room state to database...');
    await flushRooms();

    httpServer.close(() => {
      console.log('[shutdown] HTTP server closed');
      process.exit(0);
    });

    // Force exit after 10 seconds if graceful shutdown hangs
    setTimeout(() => {
      console.error('[shutdown] Forced exit after timeout');
      process.exit(1);
    }, 10_000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
});
