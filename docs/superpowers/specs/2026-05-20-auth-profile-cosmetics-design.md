# Auth, Persistent Profiles & Cosmetics — Design Spec
**Date:** 2026-05-20  
**Project:** 3 of Spades  
**Status:** Approved ✅

---

## 1. Overview

Add persistent player accounts (email + password auth), cross-device session resumption, a full profile/settings page, a global leaderboard, and a gameplay-earned cosmetics system. Guest play is removed — all players must register before joining or creating a game.

---

## 2. Architecture

### Auth Stack
- **NextAuth.js v5** (Auth.js) with `CredentialsProvider` (email + password)
- Passwords hashed with **bcrypt** (cost factor 12)
- Session stored as a **JWT in an httpOnly cookie** — survives tab close, device switches, and server restarts
- **No email verification** on signup; password reset via emailed token only

### Database
- **PostgreSQL** via **Prisma ORM**
- Local dev: `docker-compose.yml` with a `postgres:16` container
- Production: any hosted Postgres — Railway, Neon, Supabase, etc. — configured via `DATABASE_URL` env var
- Zero vendor lock-in

### Socket Identity (change from current)
- **Current:** ephemeral `playerId` (UUID) stored in `localStorage`
- **After:** socket handshake sends the NextAuth JWT → server middleware extracts `userId` → player is identified persistently
- The in-memory `Player.id` value (currently a random UUID from `uuidv4()`) will now be set to `User.id` from the DB — same UUID format, backwards-compatible with all game logic. `avatarUrl` on the Player object will be the Cloudinary URL from the User record.

### Avatar Storage
- Uploaded avatars stored on **Cloudinary** (free tier: 25GB storage, 25GB bandwidth/month)
- DB stores only the Cloudinary URL — no base64 blobs in DB or localStorage
- Preset avatars (12 options) are bundled static assets — no external storage needed

### Email (Transactional)
- **Resend** for password-reset emails (free tier: 3,000 emails/month)
- Single template: reset link with a 1-hour expiry token

---

## 3. Database Schema

```prisma
model User {
  id              String   @id @default(uuid())   // UUID to match existing game logic
  email           String   @unique
  passwordHash    String
  displayName     String
  bio             String   @default("")
  avatarUrl       String   @default("")         // Cloudinary URL (only set when avatarType="upload")
  avatarType      String   @default("preset")   // "upload" | "preset"
  presetAvatarId  String   @default("default")  // key into preset config; ignored when avatarType="upload"
  equippedFrameId     String @default("none")
  equippedCardBackId  String @default("default")
  equippedTableThemeId String @default("default")
  equippedTitleId     String @default("none")
  equippedEmoteIds    String[] @default([])     // array of emote keys
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  stats            PlayerStats?
  unlockedCosmetics UnlockedCosmetic[]
  passwordResetTokens PasswordResetToken[]
}

model PlayerStats {
  id           String @id @default(uuid())
  userId       String @unique
  user         User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  gamesPlayed  Int    @default(0)
  gamesWon     Int    @default(0)
  totalPoints  Int    @default(0)
  totalTricks  Int    @default(0)
  winStreak    Int    @default(0)   // current streak
  maxWinStreak Int    @default(0)   // all-time best
  updatedAt    DateTime @updatedAt
}

model UnlockedCosmetic {
  id          String   @id @default(uuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  cosmeticId  String                           // key into cosmetics config
  unlockedAt  DateTime @default(now())
  @@unique([userId, cosmeticId])
}

model PasswordResetToken {
  id        String   @id @default(uuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  tokenHash String   @unique                  // bcrypt hash of the raw token
  expiresAt DateTime
  used      Boolean  @default(false)
}
```

### Cosmetics Config (static, not in DB)
Defined in `config/cosmetics.ts` — each entry has: `id`, `type` (frame|cardBack|tableTheme|emote|title), `label`, `preview`, and `unlockCondition` (e.g. `{ stat: 'gamesWon', threshold: 10 }`). Checked at `game_end` — any newly satisfied condition triggers an `UnlockedCosmetic` row insert + socket notification.

**Cosmetics inventory:**

| Type | Count | Unlock Conditions |
|---|---|---|
| Avatar frames | 6 | 0 / 10 / 50 / 100 wins, win streak 5, total points 10K |
| Card back skins | 5 | 0 / 100 / 200 / 500 games, points 5K |
| Table themes | 4 | 0 / points 1K / 5K / 10K |
| Emotes | 8 | Various — wins, bid wins, trick count, streaks |
| Title badges | 10 | Ace, Trick Master, Slam King, Legend, etc. |

---

## 4. New Pages & Routes

### Auth Pages (unauthenticated only — redirect `/` if logged in)
| Route | Component | Description |
|---|---|---|
| `/login` | `app/login/page.tsx` | Centered card, Login/Register tab toggle |
| `/forgot-password` | `app/forgot-password/page.tsx` | Email input → sends reset link |
| `/reset-password/[token]` | `app/reset-password/[token]/page.tsx` | New password form, validates token |

**Login/Register UI:** Single centered card with spade logo + tab switcher. Register tab adds a Display Name field. Auto-redirects to `/lobby` after success (or back to the page the user was trying to reach).

### Authenticated Pages
| Route | Description |
|---|---|
| `/profile` | Hero + Tabs: Profile / Cosmetics / Stats / Settings |
| `/leaderboard` | Podium top 3 + ranked list, time filters (All Time / Month / Week) |

### Gated Pages (unchanged in function, now require session)
`/lobby`, `/room/[roomId]`, `/game/[roomId]` — redirect to `/login` if no session.

### API Routes (new)
| Route | Method | Description |
|---|---|---|
| `/api/auth/[...nextauth]` | * | NextAuth.js handler |
| `/api/auth/forgot-password` | POST | Generate + email reset token |
| `/api/auth/reset-password` | POST | Validate token, update password |
| `/api/profile` | PATCH | Update displayName, bio, equippedCosmetics |
| `/api/profile/avatar` | POST | Upload to Cloudinary, update avatarUrl |
| `/api/leaderboard` | GET | Paginated leaderboard with time filter |
| `/api/og/profile/[userId]` | GET | OG image for social sharing card |

---

## 5. Middleware Route Protection

Single `middleware.ts` at project root — no per-page auth checks:

```ts
// Protects /lobby, /room/*, /game/*, /profile, /leaderboard
// Redirects to /login with ?callbackUrl= for post-login redirect
// Redirects authenticated users away from /login, /register
```

---

## 6. Reconnect Flow (Cross-Device)

1. Player disconnects mid-game → bot takes over immediately (current behavior, unchanged)
2. Player logs in from **any device** → socket handshake sends JWT cookie
3. Server finds `userId` in active room → restores player to their seat → bot steps down → play resumes from current game state
4. If game already ended → client sees the results/scoreboard page
5. Grace window: 60 seconds (unchanged) before the bot substitution becomes permanent

**Key change in `socketServer.ts`:** Reconnect matching changes from `playerId` (localStorage) to `userId` (JWT). The server-side `Player` object gains a `userId` field alongside `id` (which can remain as the in-room seat identifier for backwards compat with game logic).

---

## 7. Profile Page — `/profile`

**Layout: Hero + Tabs**

```
┌─────────────────────────────────┐
│  [← Back]    My Profile   [Edit]│
├─────────────────────────────────┤
│        [Avatar + Frame]         │
│        Display Name             │
│     🏆 Title Badge              │
│  [Games] [Win Rate] [Points]    │
├─────────────────────────────────┤
│ Profile | Cosmetics | Stats | ⚙ │
├─────────────────────────────────┤
│  (tab content)                  │
└─────────────────────────────────┘
```

**Tab: Profile**
- Edit display name, bio/tagline
- Change avatar: upload photo OR pick from 12 presets
- Change password (inline form)

**Tab: Cosmetics**
- 4-column grid of all cosmetics, grouped by category tabs (Frames / Card Backs / Table / Emotes / Titles)
- Live avatar preview at top updates as player taps items
- Equipped items show "ON" badge; locked items show 🔒 + unlock requirement
- "Equip" button applies selection and saves to server

**Tab: Stats**
- Games played, games won, win rate %, total points, total tricks won, current win streak, max win streak
- Global leaderboard rank (link to `/leaderboard`)

**Tab: Settings (⚙)**
- Privacy: show/hide stats on leaderboard (toggle)
- Blocked players list (remove blocks)
- Social sharing card: preview + copy link / share button (uses `/api/og/profile/[userId]`)
- Danger zone: Delete account (confirmation dialog)

---

## 8. Leaderboard — `/leaderboard`

**Layout: Podium + List**

- Top 3 shown as a podium with crown + glow on #1
- Time filter pills: All Time / This Month / This Week
- Ranked list below top 3 — shows avatar, frame, display name, title badge, total points
- **Your row always visible** — pinned near bottom of screen if not in viewport (sticky)
- Real-time updates pushed via Socket.IO on `game_end` events (no polling)
- Search by player name (client-side filter on loaded data)
- Pagination: load top 100 initially, infinite scroll for more

---

## 9. Cosmetics Unlock Notifications

On `game_end`, server:
1. Fetches player's current `PlayerStats` after updating them
2. Checks all cosmetics config entries against `stats` values
3. Inserts any newly unlocked `UnlockedCosmetic` rows (skips existing via `@@unique`)
4. Emits `player:cosmeticUnlocked { cosmeticId, label, type }` to that player's socket
5. Client shows toast: *"🏆 New frame unlocked: Gold Crown!"* with a "View" button linking to `/profile?tab=cosmetics`

---

## 10. Production-Grade Additions

| Feature | Implementation | Why |
|---|---|---|
| Rate limiting | `lib/rateLimit.ts` middleware on auth routes (5 req/min per IP) | Prevent brute force |
| Avatar on Cloudinary | `lib/cloudinary.ts` upload helper | No base64 in DB, fast CDN delivery |
| OG social card | `app/api/og/profile/[userId]/route.ts` using `@vercel/og` | Shareable profile image |
| Real-time leaderboard | Socket.IO `leaderboard:update` event on `game_end` | No polling needed |
| Resend email | `lib/email.ts` wrapper around Resend SDK | Password reset |
| Middleware protection | Single `middleware.ts` | No scattered auth checks |

---

## 11. Environment Variables (additions)

```env
# Database
DATABASE_URL="postgresql://user:pass@localhost:5432/3ofspades"

# NextAuth
NEXTAUTH_SECRET="<random 32+ char string>"
NEXTAUTH_URL="http://localhost:3000"

# Cloudinary
CLOUDINARY_CLOUD_NAME=""
CLOUDINARY_API_KEY=""
CLOUDINARY_API_SECRET=""

# Resend (email)
RESEND_API_KEY=""
RESEND_FROM="noreply@yourdomain.com"
```

---

## 12. Out of Scope (this spec)

- Social login (Google OAuth) — can be added later as another NextAuth provider
- In-app friend system / friend leaderboard
- Push notifications
- Paid cosmetics / store
- Admin dashboard

---

## 13. Implementation Order

1. **Prisma + PostgreSQL setup** — schema, migrations, Docker Compose
2. **NextAuth.js** — install, configure, login/register/forgot-password pages
3. **Middleware** — route protection
4. **Socket auth** — extract userId from JWT in handshake, update reconnect logic
5. **Profile API + page** — PATCH endpoint, hero+tabs UI
6. **Avatar upload** — Cloudinary integration
7. **Cosmetics system** — config, unlock checker, equip API, grid UI
8. **Stats tracking** — update PlayerStats on game_end
9. **Leaderboard** — page + API + real-time updates
10. **Social sharing card** — OG image API route
11. **Rate limiting + email** — Resend + rateLimit middleware
12. **End-to-end testing** — auth flow, reconnect, unlock triggers
