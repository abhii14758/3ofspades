# Phase 1: Auth & Cross-Device Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all cross-device bugs so a player can log in from any device and rejoin their active game, with the old device getting kicked.

**Architecture:** Remove the ACCOUNT_IN_GAME login blocker. Add a userId-to-socket map in the socket server for session takeover. Use `/api/game/active` to auto-redirect authenticated users to their active game. Fix reconnect to use the JWT userId instead of localStorage playerId.

**Tech Stack:** NextAuth v5, Socket.IO, Prisma, Zustand, React hooks

---

### File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Modify | `auth.ts` | Remove ACCOUNT_IN_GAME block |
| Modify | `server.ts` | Add userIdToSocket map, session takeover logic |
| Modify | `lib/socket/socketServer.ts` | Fix room:join reconnect during active game, add session takeover cleanup |
| Modify | `hooks/useSocket.ts` | Fix reconnect to use userId, add active game redirect |
| Modify | `game/[roomId]/page.tsx` | Fix reconnect useEffect to use userId fallback |
| Modify | `components/providers/UserSync.tsx` | Populate roomId from /api/game/active |
| Create | `hooks/useActiveGame.ts` | Hook to check for active game and redirect |
| Modify | `app/lobby/page.tsx` | Show active game banner |
| Modify | `app/page.tsx` | Show active game banner on homepage |
| Modify | `lib/socket/socketClient.ts` | Add session:takeover listener |

---

### Task 1: Remove ACCOUNT_IN_GAME login blocker

**Files:**
- Modify: `auth.ts:32-34`

- [ ] **Step 1: Remove the activeRoomId check**

In `auth.ts`, inside the `authorize()` function, remove these 3 lines (32-34):

```typescript
// DELETE THESE LINES:
if (user.activeRoomId) {
  throw new Error('ACCOUNT_IN_GAME');
}
```

The rest of the authorize function stays the same — it still validates email/password and returns the user object with `activeRoomId` included.

- [ ] **Step 2: Update the JWT callback to always include activeRoomId**

In `auth.ts`, the JWT callback already includes `activeRoomId`. Verify it reads from the fresh user object. The current code is fine — `user.activeRoomId` will be the current DB value on each login.

No change needed here, just verify the callback still works:

```typescript
jwt({ token, user }: { token: JWT; user?: { id?: string; activeRoomId?: string | null } }) {
  if (user?.id) {
    token.userId = user.id;
    token.activeRoomId = user.activeRoomId ?? null;
  }
  return token;
},
```

- [ ] **Step 3: Commit**

```bash
git add auth.ts
git commit -m "fix: remove ACCOUNT_IN_GAME login blocker for cross-device support"
```

---

### Task 2: Add session takeover in socket server

**Files:**
- Modify: `server.ts:64-101` (socket auth middleware)

- [ ] **Step 1: Add userIdToSocket map and takeover logic**

In `server.ts`, after the `const io = new SocketIOServer(...)` line and before `initSocketServer(io)`, add a new map:

```typescript
/** Tracks the latest socket per authenticated userId for session takeover. */
const userIdToSocket = new Map<string, string>();
```

Then in the `io.use()` middleware, after setting `socket.data.userId`, add session takeover logic:

```typescript
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
```

- [ ] **Step 2: Add cleanup on disconnect**

We need to clean up the map when sockets disconnect. After `initSocketServer(io)`, add:

```typescript
// Clean up userIdToSocket on disconnect
io.on('connection', (socket) => {
  socket.on('disconnect', () => {
    if (socket.data.userId) {
      const current = userIdToSocket.get(socket.data.userId);
      // Only delete if this socket is still the mapped one
      if (current === socket.id) {
        userIdToSocket.delete(socket.data.userId);
      }
    }
  });
});
```

- [ ] **Step 3: Export userIdToSocket for use in socketServer**

We need socketServer to know about this map for the reconnect path. Export it by making it a module-level variable that `initSocketServer` can access.

Actually, simpler: pass the map as a parameter. Change the `initSocketServer` call:

```typescript
initSocketServer(io, userIdToSocket);
```

And in `lib/socket/socketServer.ts`, update the signature:

```typescript
let userIdToSocketMap: Map<string, string>;

export function setupSocketServer(io: Server, userIdToSocket?: Map<string, string>): void {
  userIdToSocketMap = userIdToSocket ?? new Map();
  // ... rest of function unchanged
```

When a player successfully reconnects via `player:reconnect`, update the map:

```typescript
// In the player:reconnect handler, after socket.join(roomId):
if (userIdToSocketMap) {
  userIdToSocketMap.set(playerId, socket.id);
}
```

Similarly in `room:join` reconnect path and `room:create`.

- [ ] **Step 4: Commit**

```bash
git add server.ts lib/socket/socketServer.ts
git commit -m "feat: session takeover — kick old device when same user connects"
```

---

### Task 3: Fix room:join to allow reconnect during active game

**Files:**
- Modify: `lib/socket/socketServer.ts:820-895` (room:join handler)

- [ ] **Step 1: Reorder the game-in-progress check**

In the `room:join` handler, the current code checks `room.gameState` at line 832 and blocks with "Game already in progress". Move this check AFTER the userId-based reconnect check.

Current order:
1. Room not found → error
2. Room full → error
3. Game in progress → error (MOVE THIS)
4. userId reconnect check (existing disconnected player)

New order:
1. Room not found → error
2. Room full → error
3. If socket.data.userId, check for existing disconnected player → reconnect
4. Game in progress (no matching player) → error

Replace the room:join handler (lines ~820-895) with:

```typescript
socket.on('room:join', (payload: JoinRoomPayload) => {
  const room = rooms.get(payload.roomId);

  if (!room) {
    socket.emit('room:error', { message: 'Room not found' });
    return;
  }
  if (room.players.length >= room.maxPlayers) {
    socket.emit('room:error', { message: 'Room is full' });
    return;
  }

  const playerId = socket.data.userId ?? generatePlayerId();

  // Reconnect path: same authenticated user reconnecting to their seat
  if (socket.data.userId) {
    const existingPlayer = room.players.find(p => p.id === socket.data.userId);
    if (existingPlayer) {
      // Player is already in room — reconnect them (whether lobby or game in progress)
      const existingTimer = disconnectTimers.get(existingPlayer.id);
      if (existingTimer) { clearTimeout(existingTimer); disconnectTimers.delete(existingPlayer.id); }
      if (existingPlayer.socketId) socketToPlayer.delete(existingPlayer.socketId);
      existingPlayer.socketId = socket.id;
      existingPlayer.status = room.gameState ? 'playing' : 'ready';
      if (existingPlayer.isSubstitutedBot) { existingPlayer.type = 'human'; existingPlayer.isSubstitutedBot = false; }
      socketToPlayer.set(socket.id, { roomId: payload.roomId, playerId: existingPlayer.id });
      socket.join(payload.roomId);

      if (userIdToSocketMap) userIdToSocketMap.set(existingPlayer.id, socket.id);

      prisma.user.update({ where: { id: socket.data.userId }, data: { activeRoomId: payload.roomId } })
        .catch(err => console.error('[socket] Failed to set activeRoomId on reconnect:', err));

      socket.emit('room:joined', { room: getSafeRoom(room), playerId: existingPlayer.id });
      socket.to(payload.roomId).emit('room:updated', { room: getSafeRoom(room) });

      if (room.gameState) {
        const gs = room.gameState as GameState;
        socket.emit('game:stateSync', { gameState: getPublicGameState(gs, existingPlayer.id) });
        socket.emit('player:hand', { cards: gs.hands[existingPlayer.id] ?? [] });
        if (existingPlayer.id === gs.bidWinnerId && gs.calledCards.length > 0) {
          socket.emit('player:calledCards', { cards: gs.calledCards, slots: gs.calledCardSlots ?? [] });
        }
        if (gs.currentTurnPlayerId === existingPlayer.id) {
          scheduleAutoPlayIfNeeded(io, room);
        }
      }
      return;
    }
  }

  // Block new joins if game is already running (but reconnects were handled above)
  if (room.gameState) {
    socket.emit('room:error', { message: 'Game already in progress' });
    return;
  }

  // ... rest of the existing join logic (new player creation) unchanged
```

- [ ] **Step 2: Commit**

```bash
git add lib/socket/socketServer.ts
git commit -m "fix: allow authenticated reconnect during active game via room:join"
```

---

### Task 4: Create useActiveGame hook

**Files:**
- Create: `hooks/useActiveGame.ts`

- [ ] **Step 1: Write the hook**

```typescript
'use client';
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';

interface ActiveGameState {
  activeRoomId: string | null;
  loading: boolean;
}

export function useActiveGame(): ActiveGameState {
  const { data: session, status } = useSession();
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status !== 'authenticated' || !session?.user) {
      setLoading(false);
      return;
    }

    fetch('/api/game/active')
      .then(r => r.ok ? r.json() : { activeRoomId: null })
      .then(data => {
        setActiveRoomId(data.activeRoomId ?? null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [session, status]);

  return { activeRoomId, loading };
}
```

- [ ] **Step 2: Commit**

```bash
git add hooks/useActiveGame.ts
git commit -m "feat: add useActiveGame hook for cross-device game redirect"
```

---

### Task 5: Fix UserSync to populate roomId from active game

**Files:**
- Modify: `components/providers/UserSync.tsx`

- [ ] **Step 1: Extend UserSync to fetch active game**

Replace the entire file:

```typescript
'use client';
import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { usePlayerStore } from '@/store/playerStore';

export default function UserSync() {
  const { data: session } = useSession();
  const setUserId = usePlayerStore((s) => s.setUserId);
  const setPlayerName = usePlayerStore((s) => s.setPlayerName);
  const setPlayerId = usePlayerStore((s) => s.setPlayerId);
  const setRoomId = usePlayerStore((s) => s.setRoomId);

  useEffect(() => {
    if (!session?.user) return;
    const user = session.user as { id?: string; name?: string | null };
    if (user.id) {
      setUserId(user.id);
      setPlayerId(user.id);
    }
    if (user.name) setPlayerName(user.name);

    // Check for active game — populate roomId so reconnect can fire
    fetch('/api/game/active')
      .then(r => r.ok ? r.json() : { activeRoomId: null })
      .then(data => {
        if (data.activeRoomId) {
          setRoomId(data.activeRoomId);
        }
      })
      .catch(() => {});
  }, [session, setUserId, setPlayerName, setPlayerId, setRoomId]);

  return null;
}
```

- [ ] **Step 2: Commit**

```bash
git add components/providers/UserSync.tsx
git commit -m "fix: UserSync populates playerId and roomId from session for cross-device reconnect"
```

---

### Task 6: Fix useSocket reconnect to use userId

**Files:**
- Modify: `hooks/useSocket.ts:36-63`

- [ ] **Step 1: Update the reconnect effect to use userId**

Replace the first reconnect effect (lines 36-40) and the `connect` handler (lines 52-63) with:

```typescript
  // Re-fire reconnect if userId/roomId become available after socket already connected
  const userId = usePlayerStore((s) => s.userId);
  const storedRoomId = usePlayerStore((s) => s.roomId);

  useEffect(() => {
    if (!userId || !storedRoomId) return;
    const socket = getSocket();
    if (!socket?.connected) return;
    // Use userId (from JWT) as playerId — works across devices
    socket.emit('player:reconnect', { roomId: storedRoomId, playerId: userId });
  }, [userId, storedRoomId]);
```

In the `connect` handler inside the main useEffect:

```typescript
    socket.on('connect', () => {
      setConnected(true);
      setConnecting(false);

      // Re-attach to an in-progress room after a reconnect
      const { userId, roomId: storedRoomId } = usePlayerStore.getState();
      if (userId && storedRoomId) {
        socket.emit('player:reconnect', {
          roomId: storedRoomId,
          playerId: userId,
        });
      }
    });
```

- [ ] **Step 2: Add session:takeover listener**

In the main useEffect, add a new listener alongside the others:

```typescript
    socket.on('session:takeover', ({ message }: { message: string }) => {
      toast.error(message ?? 'Session taken over from another device');
      // Clear local state
      usePlayerStore.getState().clear();
      useLobbyStore.getState().clearRoom();
      // Redirect to login after a delay
      setTimeout(() => {
        window.location.href = '/login';
      }, 2000);
    });
```

And add cleanup:

```typescript
      socket.off('session:takeover');
```

- [ ] **Step 3: Commit**

```bash
git add hooks/useSocket.ts
git commit -m "fix: reconnect uses userId from JWT instead of localStorage playerId"
```

---

### Task 7: Fix game page reconnect useEffect

**Files:**
- Modify: `app/game/[roomId]/page.tsx:51-66`

- [ ] **Step 1: Update the reconnect effect to use userId as fallback**

Replace lines 51-66 with:

```typescript
  // Ensure socket is alive and attempt to rejoin.
  // Prefer storedPlayerId (same device), fall back to userId (new device).
  useEffect(() => {
    const socket = connectSocket();

    const attemptReconnect = () => {
      const pid = storedPlayerId || userId;
      if (pid && roomId) {
        socket.emit('player:reconnect', { roomId, playerId: pid });
      }
    };

    if (socket.connected) {
      attemptReconnect();
    }

    socket.on('connect', attemptReconnect);
    return () => { socket.off('connect', attemptReconnect); };
  }, [roomId, storedPlayerId, userId]);
```

- [ ] **Step 2: Commit**

```bash
git add app/game/[roomId]/page.tsx
git commit -m "fix: game page reconnect uses userId fallback for cross-device"
```

---

### Task 8: Add active game banner to lobby and home pages

**Files:**
- Modify: `app/lobby/page.tsx`
- Modify: `app/page.tsx`

- [ ] **Step 1: Add active game redirect to lobby page**

In `app/lobby/page.tsx`, add the import and a redirect effect inside `LobbyContent`:

```typescript
import { useActiveGame } from '@/hooks/useActiveGame';
```

Inside `LobbyContent()`, add:

```typescript
  const { activeRoomId, loading: activeLoading } = useActiveGame();

  // Auto-redirect to active game if one exists
  useEffect(() => {
    if (activeLoading || !activeRoomId) return;
    // Check if we're not already in a room
    if (!currentRoom) {
      const timer = setTimeout(() => {
        router.push(`/game/${activeRoomId}`);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [activeRoomId, activeLoading, currentRoom, router]);
```

And add a visible banner in the JSX, right after the error div:

```tsx
{activeRoomId && !activeLoading && !currentRoom && (
  <motion.div
    initial={{ opacity: 0, y: -8 }}
    animate={{ opacity: 1, y: 0 }}
    className="mb-4 p-3 rounded-xl bg-indigo-950/50 border border-indigo-700/60 text-indigo-200 text-sm flex items-center justify-between"
  >
    <span>You have an active game! Rejoining...</span>
    <button
      onClick={() => router.push(`/game/${activeRoomId}`)}
      className="text-xs bg-indigo-600 hover:bg-indigo-500 px-3 py-1 rounded-lg font-semibold"
    >
      Rejoin Now
    </button>
  </motion.div>
)}
```

- [ ] **Step 2: Add similar banner to homepage**

In `app/page.tsx`, add the same pattern — import `useActiveGame`, show a banner if activeRoomId exists.

- [ ] **Step 3: Commit**

```bash
git add app/lobby/page.tsx app/page.tsx
git commit -m "feat: auto-redirect to active game with banner on lobby/home"
```

---

### Task 9: End-to-end manual testing

**No code changes — verification only**

- [ ] **Step 1: Test same-device reconnect**
1. Start dev server: `npm run dev`
2. Register two users (A and B)
3. User A creates a room, User B joins
4. Start game
5. Refresh User A's page — should reconnect automatically
6. Verify game continues normally

- [ ] **Step 2: Test cross-device reconnect**
1. User A logged in on browser 1, in an active game
2. Open browser 2 (or incognito), log in as User A
3. Browser 1 should show "session taken over" toast and redirect to login
4. Browser 2 should be redirected to the active game
5. Verify User A resumes their seat with correct hand

- [ ] **Step 3: Test active game redirect**
1. User A is in a game on browser 1
2. User A opens the lobby URL on browser 2
3. Should see active game banner and auto-redirect to the game

- [ ] **Step 4: Test no active game**
1. User with no active game visits lobby
2. No banner shown, lobby works normally
