# Phase 3: Game State Persistence — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist room and game state to PostgreSQL so games survive server restarts and players can reconnect even after crashes.

**Architecture:** Dual-layer: in-memory maps remain primary for real-time performance, with debounced writes to PostgreSQL (Room, PlayerRecord, GameState models). On restart, recover rooms from DB. On-demand loading when a reconnect arrives for a room not in memory.

**Tech Stack:** Prisma, PostgreSQL, Socket.IO, Node.js

---

### File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Modify | `prisma/schema.prisma` | Add Room, PlayerRecord, GameState models |
| Create | `lib/db/roomPersistence.ts` | Serialize/deserialize + debounced persist |
| Modify | `lib/socket/socketServer.ts` | Integrate persistence calls into all handlers |
| Modify | `server.ts` | Graceful shutdown, pass persistence to socketServer |
| Modify | `hooks/useSocket.ts` | Add server:restarting listener |

---

### Task 1: Add Prisma models

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add Room, PlayerRecord, GameState models**

Append to `prisma/schema.prisma`:

```prisma
model RoomDB {
  id           String          @id
  name         String
  hostId       String
  config       Json
  maxPlayers   Int
  status       String          @default("lobby")
  createdAt    DateTime        @default(now())
  updatedAt    DateTime        @updatedAt

  players      PlayerRecord[]
  gameState    GameStateDB?
}

model PlayerRecord {
  id                 String   @id
  roomId             String
  name               String
  type               String   @default("human")
  status             String   @default("waiting")
  isHost             Boolean  @default(false)
  seatIndex          Int      @default(0)
  avatarType         String   @default("preset")
  presetAvatarId     String   @default("spade")
  avatarUrl          String   @default("")
  equippedFrameId    String   @default("none")
  equippedCardBackId String   @default("default")
  isSubstitutedBot   Boolean  @default(false)

  room               RoomDB   @relation(fields: [roomId], references: [id], onDelete: Cascade)

  @@unique([id, roomId])
}

model GameStateDB {
  id                  String   @id @default(uuid())
  roomId              String   @unique
  phase               String
  roundNumber         Int      @default(1)
  dealerIndex         Int      @default(0)
  currentTurnPlayerId String?
  bidWinnerId         String?
  trumpSuit           String?
  hands               Json     @default("{}")
  bidState            Json?
  currentTrick        Json?
  calledCards         Json     @default("[]")
  calledCardSlots     Json     @default("[]")
  revealedPartnerIds  Json     @default("[]")
  teams               Json?
  roundHistory        Json     @default("[]")
  completedTricks     Json     @default("[]")
  playerTotals        Json     @default("{}")
  voteEndVotes        Json     @default("{}")
  turnTimerEndsAt     Float?
  winnerTeamId        String?
  players             Json     @default("[]")
  partnerCards        Json     @default("[]")
  partnerIds          Json     @default("[]")
  playTypeCounters    Json     @default("{}")

  room                RoomDB   @relation(fields: [roomId], references: [id], onDelete: Cascade)
}
```

Note: Using `RoomDB` and `GameStateDB` names to avoid conflicts with the in-memory `Room` and `GameState` TypeScript types.

- [ ] **Step 2: Run migration**

```bash
npx prisma migrate dev --name add_room_persistence
```

Expected: Migration created and applied successfully.

- [ ] **Step 3: Regenerate Prisma client**

```bash
npx prisma generate
```

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: add RoomDB, PlayerRecord, GameStateDB models for persistence"
```

---

### Task 2: Create roomPersistence module

**Files:**
- Create: `lib/db/roomPersistence.ts`

- [ ] **Step 1: Write the serialization/deserialization module**

This module handles converting between in-memory Room objects and DB rows, plus debounced persistence.

```typescript
import { prisma } from '@/lib/db/prisma';
import type { Room, GameState, Player } from '@/types';

// ─── Serialize: in-memory → DB ──────────────────────────────────────────────

function playerToRecord(player: Player, roomId: string) {
  return {
    id: player.id,
    roomId,
    name: player.name,
    type: player.type,
    status: player.status,
    isHost: player.isHost,
    seatIndex: player.seatIndex,
    avatarType: player.avatarType ?? 'preset',
    presetAvatarId: player.presetAvatarId ?? 'spade',
    avatarUrl: player.avatarUrl ?? '',
    equippedFrameId: player.equippedFrameId ?? 'none',
    equippedCardBackId: player.equippedCardBackId ?? 'default',
    isSubstitutedBot: player.isSubstitutedBot ?? false,
  };
}

function gameStateToDB(gameState: GameState, roomId: string) {
  return {
    roomId,
    phase: gameState.phase,
    roundNumber: gameState.roundNumber,
    dealerIndex: gameState.dealerIndex,
    currentTurnPlayerId: gameState.currentTurnPlayerId,
    bidWinnerId: gameState.bidWinnerId,
    trumpSuit: gameState.trumpSuit,
    hands: gameState.hands,
    bidState: gameState.bidState ?? undefined,
    currentTrick: gameState.currentTrick ?? undefined,
    calledCards: gameState.calledCards,
    calledCardSlots: gameState.calledCardSlots,
    revealedPartnerIds: gameState.revealedPartnerIds,
    teams: gameState.teams ?? undefined,
    roundHistory: gameState.roundHistory,
    completedTricks: gameState.completedTricks,
    playerTotals: gameState.playerTotals ?? {},
    voteEndVotes: gameState.voteEndVotes ?? {},
    turnTimerEndsAt: gameState.turnTimerEndsAt,
    winnerTeamId: gameState.winnerTeamId,
    players: gameState.players,
    partnerCards: gameState.partnerCards,
    partnerIds: gameState.partnerIds,
    playTypeCounters: gameState.playTypeCounters ?? {},
  };
}

// ─── Persist: write room to DB ──────────────────────────────────────────────

export async function persistRoom(room: Room): Promise<void> {
  const playerRecords = room.players.map(p => playerToRecord(p, room.id));

  const roomData = {
    id: room.id,
    name: room.name,
    hostId: room.hostId,
    config: room.config,
    maxPlayers: room.maxPlayers,
    status: room.gameState?.phase ?? 'lobby',
    players: { deleteMany: {}, create: playerRecords },
  };

  if (room.gameState) {
    const gsData = gameStateToDB(room.gameState, room.id);
    await prisma.roomDB.upsert({
      where: { id: room.id },
      update: {
        ...roomData,
        gameState: { upsert: { create: gsData, update: gsData } },
      },
      create: {
        ...roomData,
        gameState: { create: gsData },
      },
    });
  } else {
    await prisma.roomDB.upsert({
      where: { id: room.id },
      update: { ...roomData, gameState: { delete: true } },
      create: { ...roomData },
    });
  }
}

// ─── Persist game state only (lighter write for frequent updates) ────────────

export async function persistGameState(room: Room): Promise<void> {
  if (!room.gameState) return;
  const gsData = gameStateToDB(room.gameState, room.id);

  await prisma.gameStateDB.upsert({
    where: { roomId: room.id },
    update: gsData,
    create: gsData,
  });

  // Also update room status
  await prisma.roomDB.update({
    where: { id: room.id },
    data: { status: room.gameState.phase },
  });
}

// ─── Delete room from DB ────────────────────────────────────────────────────

export async function deleteRoom(roomId: string): Promise<void> {
  await prisma.roomDB.delete({ where: { id: roomId } }).catch(() => {});
}

// ─── Deserialize: DB → in-memory ────────────────────────────────────────────

export async function loadRoomFromDB(roomId: string): Promise<Room | null> {
  const dbRoom = await prisma.roomDB.findUnique({
    where: { id: roomId },
    include: { players: true, gameState: true },
  });

  if (!dbRoom) return null;

  const players: Player[] = dbRoom.players.map(pr => ({
    id: pr.id,
    name: pr.name,
    type: pr.type as Player['type'],
    status: pr.status as Player['status'],
    isHost: pr.isHost,
    seatIndex: pr.seatIndex,
    socketId: undefined, // Will be set on reconnect
    avatarType: pr.avatarType as 'preset' | 'upload',
    presetAvatarId: pr.presetAvatarId,
    avatarUrl: pr.avatarUrl,
    equippedFrameId: pr.equippedFrameId,
    equippedCardBackId: pr.equippedCardBackId,
    isSubstitutedBot: pr.isSubstitutedBot,
  }));

  let gameState: GameState | null = null;
  if (dbRoom.gameState) {
    const gs = dbRoom.gameState;
    gameState = {
      roomId: gs.roomId,
      phase: gs.phase as GameState['phase'],
      roundNumber: gs.roundNumber,
      players: gs.players as Player[],
      hands: gs.hands as Record<string, import('@/types').Card[]>,
      currentTrick: gs.currentTrick as GameState['currentTrick'],
      completedTricks: gs.completedTricks as GameState['completedTricks'],
      bidState: gs.bidState as GameState['bidState'],
      trumpSuit: gs.trumpSuit as GameState['trumpSuit'],
      partnerCards: gs.partnerCards as GameState['partnerCards'],
      calledCards: gs.calledCards as GameState['calledCards'],
      bidWinnerId: gs.bidWinnerId,
      partnerIds: gs.partnerIds as string[],
      revealedPartnerIds: gs.revealedPartnerIds as string[],
      calledCardSlots: gs.calledCardSlots as GameState['calledCardSlots'],
      playTypeCounters: gs.playTypeCounters as Record<string, number>,
      teams: gs.teams as GameState['teams'],
      dealerIndex: gs.dealerIndex,
      currentTurnPlayerId: gs.currentTurnPlayerId,
      turnTimerEndsAt: gs.turnTimerEndsAt,
      roundHistory: gs.roundHistory as GameState['roundHistory'],
      winnerTeamId: gs.winnerTeamId as GameState['winnerTeamId'],
      voteEndVotes: gs.voteEndVotes as Record<string, boolean>,
      playerTotals: gs.playerTotals as Record<string, number>,
    };
  }

  return {
    id: dbRoom.id,
    name: dbRoom.name,
    hostId: dbRoom.hostId,
    players,
    gameState,
    maxPlayers: dbRoom.maxPlayers,
    createdAt: dbRoom.createdAt.getTime(),
    config: dbRoom.config as import('@/types').RoomConfig,
  };
}

// ─── Load all active rooms (for restart recovery) ──────────────────────────

export async function loadAllActiveRooms(): Promise<Room[]> {
  const activeStatuses = ['lobby', 'dealing', 'bidding', 'trump_selection', 'partner_selection', 'playing', 'round_end'];
  const dbRooms = await prisma.roomDB.findMany({
    where: { status: { in: activeStatuses } },
    include: { players: true, gameState: true },
  });

  const rooms: Room[] = [];
  for (const dbRoom of dbRooms) {
    const room = await loadRoomFromDB(dbRoom.id);
    if (room) {
      // Set all human players to disconnected so they'll reconnect
      for (const player of room.players) {
        if (player.type === 'human') {
          player.status = 'disconnected';
          player.socketId = undefined;
        }
      }
      rooms.push(room);
    }
  }

  return rooms;
}

// ─── Debounced persistence ──────────────────────────────────────────────────

const pendingPersists = new Map<string, NodeJS.Timeout>();

const PERSIST_INTERVAL_MS = 3000;

/** Schedule a debounced persist for a room. Call after every game action. */
export function schedulePersist(roomId: string, rooms: Map<string, Room>): void {
  const existing = pendingPersists.get(roomId);
  if (existing) return; // Already scheduled

  const timer = setTimeout(async () => {
    pendingPersists.delete(roomId);
    const room = rooms.get(roomId);
    if (!room) return;
    try {
      await persistGameState(room);
    } catch (err) {
      console.error(`[persist] Failed for room ${roomId}:`, err);
    }
  }, PERSIST_INTERVAL_MS);

  pendingPersists.set(roomId, timer);
}

/** Cancel a pending persist (e.g., room was deleted). */
export function cancelPersist(roomId: string): void {
  const timer = pendingPersists.get(roomId);
  if (timer) {
    clearTimeout(timer);
    pendingPersists.delete(roomId);
  }
}

/** Immediately persist all pending rooms (for graceful shutdown). */
export async function flushAllPending(rooms: Map<string, Room>): Promise<void> {
  for (const [roomId, timer] of pendingPersists) {
    clearTimeout(timer);
    pendingPersists.delete(roomId);
  }
  const promises: Promise<void>[] = [];
  for (const [roomId, room] of rooms) {
    promises.push(persistRoom(room).catch(err => console.error(`[flush] Room ${roomId}:`, err)));
  }
  await Promise.all(promises);
}

// ─── Cleanup old rooms ─────────────────────────────────────────────────────

/** Delete rooms that have been in game_end for over 30 minutes. */
export async function cleanupOldRooms(): Promise<number> {
  const cutoff = new Date(Date.now() - 30 * 60 * 1000);
  const result = await prisma.roomDB.deleteMany({
    where: {
      status: 'game_end',
      updatedAt: { lt: cutoff },
    },
  });
  return result.count;
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/db/roomPersistence.ts
git commit -m "feat: add room persistence module — serialize, deserialize, debounced writes"
```

---

### Task 3: Integrate persistence into socket server

**Files:**
- Modify: `lib/socket/socketServer.ts`

This is the biggest task. We add persistence calls at key points in the socket handlers.

- [ ] **Step 1: Import persistence functions**

At the top of `socketServer.ts`, add:

```typescript
import { persistRoom, persistGameState, deleteRoom, schedulePersist, cancelPersist, loadRoomFromDB, loadAllActiveRooms, flushAllPending, cleanupOldRooms } from '@/lib/db/roomPersistence';
```

- [ ] **Step 2: Update setupSocketServer signature**

Accept the `rooms` map as exportable for the flush function, or keep it module-scoped:

```typescript
export function setupSocketServer(io: Server, userIdToSocket?: Map<string, string>): void {
```

- [ ] **Step 3: Replace stale activeRoomId cleanup with room recovery**

Replace the startup `prisma.user.updateMany` with room recovery:

```typescript
  // On startup, recover rooms from database
  loadAllActiveRooms()
    .then(recoveredRooms => {
      for (const room of recoveredRooms) {
        rooms.set(room.id, room);
        for (const player of room.players) {
          socketToPlayer.set(`recovery:${player.id}`, { roomId: room.id, playerId: player.id });
        }
      }
      if (recoveredRooms.length > 0) {
        console.log(`[socket] Recovered ${recoveredRooms.length} room(s) from database`);
      }
      // Clear stale activeRoomIds for users not in any recovered room
      const activeRoomIds = new Set(recoveredRooms.map(r => r.id));
      prisma.user.findMany({ where: { activeRoomId: { not: null } }, select: { id: true, activeRoomId: true } })
        .then(users => {
          const toClear = users.filter(u => u.activeRoomId && !activeRoomIds.has(u.activeRoomId));
          if (toClear.length > 0) {
            prisma.user.updateMany({
              where: { id: { in: toClear.map(u => u.id) } },
              data: { activeRoomId: null },
            }).then(r => console.log(`[socket] Cleared ${r.count} stale activeRoomId(s)`));
          }
        });
    })
    .catch(err => console.error('[socket] Failed to recover rooms:', err));

  // Periodic cleanup of old game_end rooms
  setInterval(() => {
    cleanupOldRooms().then(count => {
      if (count > 0) console.log(`[cleanup] Deleted ${count} old game_end room(s)`);
    });
  }, 5 * 60 * 1000); // Every 5 minutes
```

- [ ] **Step 4: Add persistence calls in room:create**

After `rooms.set(roomId, room)`:

```typescript
      persistRoom(room).catch(err => console.error('[persist] room:create:', err));
```

- [ ] **Step 5: Add persistence calls in room:join**

After successfully adding a player to the room, before `socket.emit('room:joined')`:

```typescript
      persistRoom(room).catch(err => console.error('[persist] room:join:', err));
```

Also in the reconnect path within room:join.

- [ ] **Step 6: Add persistence calls in game:start**

After `room.gameState = gameState`:

```typescript
      persistRoom(room).catch(err => console.error('[persist] game:start:', err));
```

- [ ] **Step 7: Add debounced persistence after game actions**

After `handlePlaceBid`, `handleSelectTrump`, `handleSelectPartners`, `handlePlayCard`:

```typescript
      schedulePersist(roomId, rooms);
```

After `finalizeRound` (round end):
```typescript
      persistRoom(room).catch(err => console.error('[persist] roundEnd:', err));
```

After `game:end`:
```typescript
      persistRoom(room).catch(err => console.error('[persist] gameEnd:', err));
```

- [ ] **Step 8: Add persistence in room:leave and room:kickPlayer**

On leave:
```typescript
      persistRoom(room).catch(err => console.error('[persist] room:leave:', err));
```

When room is deleted:
```typescript
      deleteRoom(roomId).catch(err => console.error('[persist] room:delete:', err));
      cancelPersist(roomId);
```

- [ ] **Step 9: Add on-demand loading in player:reconnect**

At the start of the `player:reconnect` handler, if the room isn't in memory:

```typescript
      let room = rooms.get(roomId);

      if (!room) {
        // Room not in memory — try loading from DB
        const loaded = await loadRoomFromDB(roomId);
        if (loaded) {
          rooms.set(roomId, loaded);
          room = loaded;
          console.log(`[socket] Loaded room ${roomId} from database on reconnect`);
        }
      }

      if (!room) {
        socket.emit('room:error', { message: 'Room not found' });
        return;
      }
```

Note: The `player:reconnect` handler needs to become `async` or use `.then()`.

- [ ] **Step 10: Add persistence in room:create (already done above, verify)**

- [ ] **Step 11: Commit**

```bash
git add lib/socket/socketServer.ts
git commit -m "feat: integrate persistence into all socket handlers"
```

---

### Task 4: Add graceful shutdown

**Files:**
- Modify: `server.ts`

- [ ] **Step 1: Add shutdown handlers**

After `httpServer.listen(...)`, add:

```typescript
  // Graceful shutdown — persist all state before exiting
  const shutdown = async (signal: string) => {
    console.log(`\n[${signal}] Shutting down gracefully...`);

    // Notify all connected clients
    io.emit('server:restarting', { message: 'Server is restarting. Your game is saved.' });

    // Allow 2 seconds for clients to receive the notification
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Flush all pending room state to DB
    const { flushAllPending } = await import('./lib/db/roomPersistence');
    // Import rooms map from socketServer — we need to export it
    // For now, flush via the exported function
    // We'll need to export the rooms map or create a flush endpoint

    console.log('[shutdown] Flushing room state to database...');
    // This requires access to the rooms map — we'll pass it through initSocketServer
    // For now, close HTTP server
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
```

To flush the rooms, we need to export the rooms map from socketServer or pass a flush function. Update `setupSocketServer` to return a flush function:

In `socketServer.ts`:
```typescript
export function setupSocketServer(io: Server, userIdToSocket?: Map<string, string>): () => Promise<void> {
  // ... existing code ...

  // Return a flush function for graceful shutdown
  return () => flushAllPending(rooms);
}
```

In `server.ts`, capture it:
```typescript
const flushRooms = initSocketServer(io, userIdToSocket);
```

And in the shutdown handler:
```typescript
    await flushRooms();
```

- [ ] **Step 2: Commit**

```bash
git add server.ts lib/socket/socketServer.ts
git commit -m "feat: graceful shutdown with state persistence on SIGTERM/SIGINT"
```

---

### Task 5: Add server:restarting listener on client

**Files:**
- Modify: `hooks/useSocket.ts`

- [ ] **Step 1: Add listener**

In the main useEffect, add:

```typescript
    socket.on('server:restarting', ({ message }: { message: string }) => {
      toast(message ?? 'Server is restarting. Your game will be saved.', {
        duration: 5000,
        icon: '🔄',
      });
    });
```

And cleanup:
```typescript
      socket.off('server:restarting');
```

- [ ] **Step 2: Commit**

```bash
git add hooks/useSocket.ts
git commit -m "feat: handle server:restarting event on client"
```

---

### Task 6: Update PlayerStats on game end

**Files:**
- Modify: `lib/socket/socketServer.ts` (game:end handler)

- [ ] **Step 1: Add stats update after game end**

After the `game:end` emit and `activeRoomId` clearing (around line 718), add:

```typescript
        // Update player stats for all human players
        if (finalState.teams && finalState.winnerTeamId) {
          const winnerTeam = finalState.teams[finalState.winnerTeamId];
          for (const player of room.players) {
            if (player.type !== 'human' && !player.isSubstitutedBot) continue;
            const isWinner = winnerTeam.playerIds.includes(player.id);
            const playerPoints = updatedPlayerTotals[player.id] ?? 0;
            await prisma.playerStats.upsert({
              where: { userId: player.id },
              update: {
                gamesPlayed: { increment: 1 },
                gamesWon: isWinner ? { increment: 1 } : undefined,
                totalPoints: { increment: Math.max(0, playerPoints) },
                totalTricks: { increment: winnerTeam.tricksWon },
                winStreak: isWinner ? { increment: 1 } : { set: 0 },
              },
              create: {
                userId: player.id,
                gamesPlayed: 1,
                gamesWon: isWinner ? 1 : 0,
                totalPoints: Math.max(0, playerPoints),
                totalTricks: winnerTeam.tricksWon,
                winStreak: isWinner ? 1 : 0,
              },
            }).catch(err => console.error(`[stats] Failed for ${player.id}:`, err));
          }
        }
```

Note: Prisma's atomic `{ increment: N }` doesn't work with `upsert`'s `update` in all versions. If it doesn't, use a read-then-write approach instead:

```typescript
            const stats = await prisma.playerStats.findUnique({ where: { userId: player.id } });
            if (stats) {
              const newStreak = isWinner ? stats.winStreak + 1 : 0;
              await prisma.playerStats.update({
                where: { userId: player.id },
                data: {
                  gamesPlayed: stats.gamesPlayed + 1,
                  gamesWon: stats.gamesWon + (isWinner ? 1 : 0),
                  totalPoints: stats.totalPoints + Math.max(0, playerPoints),
                  totalTricks: stats.totalTricks + winnerTeam.tricksWon,
                  winStreak: newStreak,
                  maxWinStreak: Math.max(stats.maxWinStreak, newStreak),
                },
              });
            }
```

- [ ] **Step 2: Commit**

```bash
git add lib/socket/socketServer.ts
git commit -m "feat: update PlayerStats on game end"
```

---

### Task 7: Manual testing

- [ ] **Step 1: Test basic persistence**
1. Start server: `npm run dev`
2. Create a room, join with 2 players, start game
3. Play a few tricks
4. Stop the server (Ctrl+C)
5. Restart the server
6. Log in as one of the players
7. Verify you're redirected to the active game
8. Verify the game state is correct (hands, tricks, scores)

- [ ] **Step 2: Test cross-device with persistence**
1. Player A in game on browser 1
2. Log in as Player A on browser 2
3. Browser 1 gets kicked, browser 2 resumes the game
4. Stop server, restart
5. Player A reconnects — game should be exactly where they left off

- [ ] **Step 3: Test cleanup**
1. Finish a game (game_end)
2. Wait 30+ minutes (or manually set updatedAt back)
3. Verify the room is cleaned up from DB
