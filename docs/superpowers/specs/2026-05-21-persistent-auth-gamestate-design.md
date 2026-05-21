# Persistent Auth & Game State Design

**Date:** 2026-05-21
**Status:** Draft
**Scope:** Cross-device session management, enhanced profile/settings, game state persistence

---

## Background

The 3 of Spades (Kali Teeri) card game currently stores all game state in the socket server's memory. Player identity is tracked via NextAuth JWT + localStorage. Several cross-device bugs prevent players from rejoining a game from a different device. This spec covers fixes and enhancements across 3 phases.

---

## Phase 1: Auth & Cross-Device Fix

### Bug Fixes

**Fix 1 — Remove ACCOUNT_IN_GAME login block**

File: `auth.ts`, `authorize()` function (lines 32-34)

Remove the `activeRoomId` check that throws `ACCOUNT_IN_GAME`. Allow login regardless of active game status. The cross-device flow handles the active game case gracefully.

**Fix 2 — Session takeover on socket connect**

File: `server.ts`, socket auth middleware

Add a `userIdToSocket` map: `Map<string, string>` (userId → socketId). When a new socket connects with `socket.data.userId`:
1. Check if an existing socket exists for that userId in the map
2. If so, emit `session:takeover` to the old socket with a message like "Your session was taken over from another device"
3. Disconnect the old socket
4. Map the new socket

On disconnect, clean up the map.

**Fix 3 — New device reconnect uses userId from JWT**

Files: `useSocket.ts`, `game/[roomId]/page.tsx`

The current reconnect logic sends `player:reconnect` with `storedPlayerId` from localStorage. On a new device, this is null.

Changes:
- `useSocket.ts` connect handler: if `userId` exists (from UserSync) and `activeRoomId` exists (from `/api/game/active`), emit `player:reconnect` with `playerId: userId`
- `game/[roomId]/page.tsx` reconnect useEffect: use `userId` as fallback when `storedPlayerId` is null
- Ensure `UserSync` populates the `roomId` in playerStore from `/api/game/active` response

**Fix 4 — room:join reconnect path during active game**

File: `socketServer.ts`, `room:join` handler (line 832)

Currently: if `room.gameState` exists, returns "Game already in progress". Change to: if `socket.data.userId` matches a disconnected player in the room, follow the reconnect path regardless of game state.

### Active Game Redirect Flow

When any authenticated page loads:
1. Call `/api/game/active` (already exists)
2. If `activeRoomId` returned, show a banner or auto-redirect to `/game/[activeRoomId]`
3. The game page connects socket and emits `player:reconnect` with `playerId = socket.data.userId`

Implementation:
- Add a `useActiveGame()` hook that fetches `/api/game/active` on mount and returns `{ activeRoomId, loading }`
- Use in lobby page and homepage
- Show a dismissible banner: "You have an active game in Room [CODE]. [Rejoin]"
- Auto-redirect with a 3-second countdown (cancelable)

### Schema Changes

None. `activeRoomId` on User model already exists.

---

## Phase 2: Enhanced Profile & Settings

### Profile Avatar Size

Current avatar display: ~40px (seats), ~64px (profile).

New sizes:
- Game seats: 48px (minor bump for clarity)
- Profile hero: 192px
- Profile card: 128px
- Upload resolution: 256px (via Cloudinary transform)

Update `AvatarDisplay` component to accept and render at these sizes.

### Unified Settings Page

Refactor `/profile` into a unified page with tabs:
- **Profile** — display name, bio, avatar, frame (current)
- **Cosmetics** — card back, table theme, emote wheel config
- **Stats** — game statistics (current)
- **Settings** — general preferences
- **Security** — change password, sign out (current)

### Card Back Cosmetics

New config file: `config/cardBacks.ts`

Card back designs: Classic, Midnight, Royal, Neon, Galaxy, etc.

- Player selects in Cosmetics tab
- Saved to `equippedCardBackId` on User (already in schema)
- Other players see the equipped card back on face-down cards
- Socket events include `equippedCardBackId` in player data

Add `equippedCardBackId` to Player type and pass through room:create, room:join events.

### Table Themes

New config file: `config/tableThemes.ts`

Background themes: Green Felt, Midnight Blue, Royal Purple, Sunset, Noir

- Player selects in Cosmetics tab
- Saved to `equippedTableThemeId` on User (already in schema)
- Applied as CSS class/gradient on the game table
- Each player sees their own theme (client-side only, no sync needed)

### Emote Wheel

New config file: `config/emotes.ts`

Quick emotes: GG, Nice Play, Oops, Thinking, Wow, Good Luck, Thanks, Hello

- Player equips up to 8 emotes in Cosmetics tab
- Saved to `equippedEmoteIds` on User (already in schema, string array)
- In-game: floating button triggers emote wheel overlay
- Selecting an emote emits `game:emote` socket event
- Server broadcasts to room with 3-second display duration
- Other players see the emote as a toast/overlay near the player's seat

New socket events:
- `game:emote` (client → server): `{ roomId, emoteId }`
- `game:emote` (server → room): `{ playerId, emoteId, playerName }`

### General Preferences

Stored in localStorage (no DB needed):
- Sound effects volume (0-100)
- Music volume (0-100)
- Mute toggle
- Language preference (default: en)

New Zustand store: `settingsStore` with persist middleware.

### New API Endpoints

- `GET /api/cosmetics` — returns catalog of available cosmetics (card backs, table themes, emotes)
- Extend `PATCH /api/profile` to handle `equippedCardBackId`, `equippedTableThemeId`, `equippedEmoteIds`

---

## Phase 3: Game State Persistence

### New Prisma Models

```prisma
model Room {
  id           String         @id
  name         String
  hostId       String
  config       Json
  maxPlayers   Int
  status       String         @default("lobby")
  createdAt    DateTime       @default(now())
  updatedAt    DateTime       @updatedAt

  players      PlayerRecord[]
  gameState    GameState?
}

model PlayerRecord {
  id                String   @id
  roomId            String
  name              String
  type              String   // human | bot
  status            String
  isHost            Boolean
  seatIndex         Int
  avatarType        String   @default("preset")
  presetAvatarId    String   @default("spade")
  avatarUrl         String   @default("")
  equippedFrameId   String   @default("none")
  equippedCardBackId String  @default("default")
  isSubstitutedBot  Boolean  @default(false)

  room              Room     @relation(fields: [roomId], references: [id], onDelete: Cascade)

  @@unique([id, roomId])
}

model GameState {
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

  room                Room     @relation(fields: [roomId], references: [id], onDelete: Cascade)
}
```

### Dual-Layer Architecture

During active gameplay, in-memory state remains the primary source of truth for real-time performance. DB is a write-behind cache.

**Read path:**
1. Check in-memory `rooms` map
2. If not found, query DB by roomId
3. If in DB, reconstruct in-memory Room object and return
4. If not in DB either, room doesn't exist

**Write path:**
- In-memory updates happen synchronously (as they do now)
- A debounced `persistRoom(roomId)` function writes to DB every 3 seconds during active gameplay
- Immediate writes on critical events: room creation, game start, round end, game end, player join/leave
- On game end, final persist then schedule cleanup (delete after 30 min)

### Server Restart Recovery

On `setupSocketServer(io)`:
1. Query DB for all Rooms with status in ('lobby', 'dealing', 'bidding', 'trump_selection', 'partner_selection', 'playing', 'round_end')
2. Deserialize each DB row into the in-memory `Room`/`Player`/`GameState` types using a `deserializeRoom()` helper that maps JSON columns back to typed objects
3. Re-schedule active timers: if a room was in `dealing` or `playing` phase, re-schedule the appropriate deal/auto-play timers from where they left off (using `turnTimerEndsAt` to check if a timer should already have fired)
4. Set all human players' status to 'disconnected' (they'll reconnect via socket)
5. Log: "Recovered N rooms from database"

### Graceful Shutdown

Listen for `SIGTERM`/`SIGINT`:
1. Persist all in-memory rooms to DB immediately
2. Emit `server:restarting` to all connected sockets
3. Allow 2 seconds for clients to receive the event
4. Exit

### On-Demand Room Loading

When `player:reconnect` arrives and the room isn't in memory:
1. Query DB: `SELECT * FROM Room WHERE id = ?`
2. If found, load Room + PlayerRecords + GameState
3. Reconstruct in-memory objects
4. Proceed with reconnect logic

### Performance Notes

- JSONB columns for GameState keep writes flexible without schema migrations per game change
- Debounced writes (3s) mean max ~0.33 DB writes/second per room
- PostgreSQL handles this volume trivially
- No Redis needed — single-server PostgreSQL is sufficient for current scale

### PlayerStats Updates

On game end, batch-update all human players' stats:
- Increment `gamesPlayed`
- Increment/decrement `gamesWon` based on winning team
- Add points to `totalPoints`
- Add tricks to `totalTricks`
- Update `winStreak` and `maxWinStreak`

---

## Production Enhancements (All Phases)

### Rate Limiting
- Socket: max 10 events per second per socket
- API: use Next.js middleware or a library like `rate-limiter-flexible`
- Registration: max 5 attempts per IP per hour

### Input Validation
- All socket payloads validated with zod schemas before processing
- API routes already have basic validation — extend with zod

### Health Check
- `GET /api/health` returns `{ ok: true, socketConnections, activeRooms }`

### Error Recovery
- Uncaught exceptions logged but don't crash the server (already done)
- Periodic cleanup of orphaned rooms (status='game_end', older than 1 hour)

---

## Implementation Order

1. Phase 1 (Auth & Cross-Device) — foundation for everything
2. Phase 2 (Enhanced Profile & Settings) — independent of Phase 3, can be done in parallel
3. Phase 3 (Game State Persistence) — largest scope, do last after auth is stable

Within Phase 1, order of changes:
1. Remove ACCOUNT_IN_GAME block
2. Add session takeover in socket middleware
3. Add `useActiveGame()` hook and redirect flow
4. Fix reconnect to use userId
5. Fix room:join to allow reconnect during active game
6. Test cross-device end-to-end
