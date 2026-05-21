import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server as SocketIOServer } from 'socket.io';
import { initSocketServer } from './lib/socket/socketServer';
import { decode } from 'next-auth/jwt';
import { parse as parseCookies } from 'cookie';

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || '0.0.0.0';
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

app.prepare().then(() => {
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

  initSocketServer(io);

  // Socket.IO auth middleware — extracts userId from NextAuth JWT cookie
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
      }

      next();
    } catch (err) {
      console.error('[socket auth middleware]', err);
      next();
    }
  });

  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
    console.log(`> Socket.IO server running`);
  });
});
