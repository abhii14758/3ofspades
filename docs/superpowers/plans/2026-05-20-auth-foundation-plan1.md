# Auth Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add persistent user accounts (email + password via Auth.js v5), PostgreSQL via Prisma, route protection middleware, and cross-device socket reconnect using the JWT session — replacing the current ephemeral localStorage-only identity.

**Architecture:** Auth.js v5 (next-auth@beta) with a Credentials provider stores a JWT in an httpOnly cookie. Prisma ORM manages the PostgreSQL schema. The Socket.IO server decodes the JWT from the cookie on every handshake so `socket.data.userId` is always the persistent user ID — enabling cross-device reconnect by matching `userId` instead of the current `socketId`-based approach.

**Tech Stack:** Auth.js v5 (`next-auth@beta`), Prisma 6, PostgreSQL 16 (Docker local), bcryptjs, Resend (email), `next-auth/jwt` decode for socket auth.

**Spec:** `docs/superpowers/specs/2026-05-20-auth-profile-cosmetics-design.md`  
**Followed by:** Plan 2 (Profile + Cosmetics), Plan 3 (Leaderboard + Polish)

---

## File Map

| Action | File | Responsibility |
|---|---|---|
| Create | `docker-compose.yml` | Local PostgreSQL container |
| Create | `.env.example` | Document required env vars |
| Create | `prisma/schema.prisma` | Full DB schema |
| Create | `lib/db/prisma.ts` | Prisma client singleton |
| Create | `auth.ts` | Auth.js v5 config (root level) |
| Create | `app/api/auth/[...nextauth]/route.ts` | Auth.js route handler |
| Create | `app/login/page.tsx` | Login/Register page (tab switcher) |
| Create | `components/auth/AuthCard.tsx` | Reusable auth card UI |
| Create | `app/forgot-password/page.tsx` | Forgot password page |
| Create | `app/reset-password/[token]/page.tsx` | Reset password page |
| Create | `app/api/auth/forgot-password/route.ts` | Generate + email token |
| Create | `app/api/auth/reset-password/route.ts` | Validate token + update password |
| Create | `lib/email.ts` | Resend email helper |
| Create | `middleware.ts` | Route protection (root level) |
| Modify | `lib/socket/socketClient.ts` | Add `withCredentials: true` |
| Modify | `server.ts` | Socket.IO auth middleware — decode JWT from cookie |
| Modify | `lib/socket/socketServer.ts` | `player:reconnect` matches on `userId` |
| Modify | `store/playerStore.ts` | Remove `playerId` (session replaces it); keep `playerName`, `roomId` |
| Modify | `hooks/useSocket.ts` | Reconnect uses `userId` from session |
| Modify | `app/lobby/page.tsx` | Pre-fill name from session; remove manual name entry if session present |
| Modify | `app/page.tsx` | Remove "works offline, no account" copy |
| Modify | `app/layout.tsx` | Add `SessionProvider` wrapper |

---

## Task 1: Docker Compose + Environment Template

**Files:**
- Create: `docker-compose.yml`
- Create: `.env.example`

- [ ] **Step 1: Create `docker-compose.yml`**

```yaml
# docker-compose.yml
version: '3.9'
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: spades
      POSTGRES_PASSWORD: spades
      POSTGRES_DB: 3ofspades
    ports:
      - '5432:5432'
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

- [ ] **Step 2: Create `.env.example`**

```env
# Database
DATABASE_URL="postgresql://spades:spades@localhost:5432/3ofspades"

# Auth.js v5 — generate with: openssl rand -base64 32
AUTH_SECRET="replace-with-random-32-char-string"

# App URL (no trailing slash)
NEXTAUTH_URL="http://localhost:3000"

# Cloudinary (Plan 2)
CLOUDINARY_CLOUD_NAME=""
CLOUDINARY_API_KEY=""
CLOUDINARY_API_SECRET=""

# Resend email (optional for local dev — reset emails won't send without it)
RESEND_API_KEY=""
RESEND_FROM="noreply@yourdomain.com"
```

- [ ] **Step 3: Copy `.env.example` to `.env.local` and fill in values**

```bash
copy .env.example .env.local
```

For local dev, `DATABASE_URL` and `AUTH_SECRET` are the only required values. Generate `AUTH_SECRET`:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

- [ ] **Step 4: Start PostgreSQL container**

```bash
docker compose up -d
```

Expected: postgres container running on port 5432.

- [ ] **Step 5: Verify connection**

```bash
docker compose exec postgres psql -U spades -d 3ofspades -c "\l"
```

Expected: list of databases including `3ofspades`.

- [ ] **Step 6: Add `.env.local` to `.gitignore` (if not already)**

```bash
# Check
Select-String ".env.local" .gitignore
```

If not found, add to `.gitignore`:
```
.env.local
```

- [ ] **Step 7: Commit**

```bash
git add docker-compose.yml .env.example .gitignore
git commit -m "chore: add docker-compose for local postgres + env template"
```

---

## Task 2: Install Dependencies

**Files:**
- Modify: `package.json` (via npm install)

- [ ] **Step 1: Install runtime dependencies**

```bash
cd D:\3ofspades
npm install next-auth@beta @prisma/client bcryptjs resend
```

- [ ] **Step 2: Install dev dependencies**

```bash
npm install -D prisma @types/bcryptjs
```

- [ ] **Step 3: Verify installs — check package.json has these entries**

Expected additions in `dependencies`:
```
"next-auth": "^5.0.0-beta.x",
"@prisma/client": "^6.x.x",
"bcryptjs": "^2.4.3",
"resend": "^3.x.x"
```

Expected in `devDependencies`:
```
"prisma": "^6.x.x",
"@types/bcryptjs": "^2.4.x"
```

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install next-auth, prisma, bcryptjs, resend"
```

---

## Task 3: Prisma Schema + Migration

**Files:**
- Create: `prisma/schema.prisma`
- Create: `lib/db/prisma.ts`

- [ ] **Step 1: Initialise Prisma**

```bash
npx prisma init --datasource-provider postgresql
```

Expected: creates `prisma/schema.prisma` and updates `.env` (ignore the `.env` — we use `.env.local`).

- [ ] **Step 2: Replace `prisma/schema.prisma` with full schema**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id              String   @id @default(uuid())
  email           String   @unique
  passwordHash    String
  displayName     String
  bio             String   @default("")
  avatarUrl       String   @default("")
  avatarType      String   @default("preset")
  presetAvatarId  String   @default("default")
  equippedFrameId      String   @default("none")
  equippedCardBackId   String   @default("default")
  equippedTableThemeId String   @default("default")
  equippedTitleId      String   @default("none")
  equippedEmoteIds     String[] @default([])
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  stats                PlayerStats?
  unlockedCosmetics    UnlockedCosmetic[]
  passwordResetTokens  PasswordResetToken[]
}

model PlayerStats {
  id           String   @id @default(uuid())
  userId       String   @unique
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  gamesPlayed  Int      @default(0)
  gamesWon     Int      @default(0)
  totalPoints  Int      @default(0)
  totalTricks  Int      @default(0)
  winStreak    Int      @default(0)
  maxWinStreak Int      @default(0)
  updatedAt    DateTime @updatedAt
}

model UnlockedCosmetic {
  id         String   @id @default(uuid())
  userId     String
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  cosmeticId String
  unlockedAt DateTime @default(now())

  @@unique([userId, cosmeticId])
}

model PasswordResetToken {
  id        String   @id @default(uuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  tokenHash String   @unique
  expiresAt DateTime
  used      Boolean  @default(false)
}
```

- [ ] **Step 3: Run migration**

```bash
npx prisma migrate dev --name init_auth_schema
```

Expected output:
```
✔ Generated Prisma Client
The following migration(s) have been created and applied:
  migrations/20260520000000_init_auth_schema/migration.sql
```

- [ ] **Step 4: Create `lib/db/prisma.ts`**

```typescript
// lib/db/prisma.ts
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

- [ ] **Step 5: Verify schema — open Prisma Studio**

```bash
npx prisma studio
```

Expected: browser opens at http://localhost:5555, shows User, PlayerStats, UnlockedCosmetic, PasswordResetToken tables. Close Prisma Studio when done.

- [ ] **Step 6: Build check**

```bash
npm run build
```

Expected: builds without TypeScript errors.

- [ ] **Step 7: Commit**

```bash
git add prisma/ lib/db/prisma.ts
git commit -m "feat: prisma schema + postgresql migration (users, stats, cosmetics, reset tokens)"
```

---

## Task 4: Auth.js v5 Config

**Files:**
- Create: `auth.ts` (project root)
- Create: `app/api/auth/[...nextauth]/route.ts`

- [ ] **Step 1: Create `auth.ts` at project root**

```typescript
// auth.ts
import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db/prisma';

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      authorize: async (credentials) => {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        });

        if (!user) return null;

        const valid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        );
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.displayName,
          image: user.avatarUrl || null,
        };
      },
    }),
  ],
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
  },
  callbacks: {
    jwt({ token, user }) {
      // Persist userId in the JWT so we can read it server-side
      if (user) token.userId = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.userId) session.user.id = token.userId as string;
      return session;
    },
  },
});
```

- [ ] **Step 2: Extend NextAuth types for `session.user.id`**

Create `types/next-auth.d.ts`:

```typescript
// types/next-auth.d.ts
import { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
    } & DefaultSession['user'];
  }
}
```

- [ ] **Step 3: Create route handler**

```typescript
// app/api/auth/[...nextauth]/route.ts
import { handlers } from '@/auth';
export const { GET, POST } = handlers;
```

- [ ] **Step 4: Create a test user directly in DB to verify auth works**

```bash
node -e "
const bcrypt = require('bcryptjs');
bcrypt.hash('password123', 12).then(h => console.log(h));
"
```

Copy the hash, then insert via Prisma Studio or psql:
```sql
INSERT INTO \"User\" (id, email, \"passwordHash\", \"displayName\", \"createdAt\", \"updatedAt\")
VALUES (gen_random_uuid(), 'test@test.com', '<hash>', 'Test User', now(), now());
```

Or use this one-liner (run from project root — needs DATABASE_URL in env):
```bash
node -e "
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();
bcrypt.hash('password123', 12).then(hash =>
  prisma.user.create({ data: { email: 'test@test.com', passwordHash: hash, displayName: 'Test User' }})
).then(u => { console.log('Created:', u.email); prisma.\$disconnect(); });
"
```

- [ ] **Step 5: Build check**

```bash
npm run build
```

Expected: no TypeScript errors.

- [ ] **Step 6: Manual verify — start dev server and test login endpoint**

```bash
npm run dev
```

Then in another terminal:
```bash
curl -X POST http://localhost:3000/api/auth/callback/credentials \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"password123"}'
```

Expected: redirect response (302) or JSON with session token. Cookie `authjs.session-token` should be set.

- [ ] **Step 7: Commit**

```bash
git add auth.ts types/next-auth.d.ts app/api/auth/
git commit -m "feat: auth.js v5 config with credentials provider + jwt session"
```

---

## Task 5: Register API Route

**Files:**
- Create: `app/api/auth/register/route.ts`

- [ ] **Step 1: Create register API route**

```typescript
// app/api/auth/register/route.ts
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db/prisma';

export async function POST(req: NextRequest) {
  try {
    const { email, password, displayName } = await req.json();

    if (!email || !password || !displayName) {
      return NextResponse.json({ error: 'All fields required' }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }
    if (displayName.trim().length < 2) {
      return NextResponse.json({ error: 'Display name must be at least 2 characters' }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        displayName: displayName.trim(),
        stats: { create: {} }, // create PlayerStats row with defaults
      },
    });

    return NextResponse.json({ id: user.id, email: user.email }, { status: 201 });
  } catch (err) {
    console.error('[register]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verify with curl**

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"newuser@test.com","password":"password123","displayName":"New User"}'
```

Expected: `{"id":"...","email":"newuser@test.com"}` with status 201.

Duplicate email:
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"newuser@test.com","password":"password123","displayName":"New User"}'
```

Expected: `{"error":"Email already registered"}` with status 409.

- [ ] **Step 3: Commit**

```bash
git add app/api/auth/register/
git commit -m "feat: register API route with validation + bcrypt hashing"
```

---

## Task 6: Login/Register Page UI

**Files:**
- Create: `components/auth/AuthCard.tsx`
- Create: `app/login/page.tsx`

- [ ] **Step 1: Create `components/auth/AuthCard.tsx`**

```typescript
// components/auth/AuthCard.tsx
'use client';
import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function AuthCard() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get('callbackUrl') || '/lobby';

  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const res = await signIn('credentials', {
      email,
      password,
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      setError('Invalid email or password.');
    } else {
      router.push(callbackUrl);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, displayName }),
    });
    const data = await res.json();
    if (!res.ok) {
      setLoading(false);
      setError(data.error || 'Registration failed.');
      return;
    }
    // Auto sign-in after registration
    const signInRes = await signIn('credentials', {
      email,
      password,
      redirect: false,
    });
    setLoading(false);
    if (signInRes?.error) {
      setError('Registered but sign-in failed. Try logging in.');
      setTab('login');
    } else {
      router.push(callbackUrl);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-6xl mb-2">♠</div>
          <h1 className="text-2xl font-black text-white">3 of Spades</h1>
          <p className="text-slate-400 text-sm mt-1">Trick-taking for 4–10 players</p>
        </div>

        {/* Card */}
        <div className="bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden shadow-2xl">
          {/* Tabs */}
          <div className="flex bg-slate-950">
            <button
              onClick={() => { setTab('login'); setError(''); }}
              className={`flex-1 py-3 text-sm font-semibold transition-colors ${
                tab === 'login'
                  ? 'bg-slate-900 text-white border-b-2 border-violet-500'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setTab('register'); setError(''); }}
              className={`flex-1 py-3 text-sm font-semibold transition-colors ${
                tab === 'register'
                  ? 'bg-slate-900 text-white border-b-2 border-violet-500'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              Register
            </button>
          </div>

          {/* Form */}
          <form
            onSubmit={tab === 'login' ? handleLogin : handleRegister}
            className="p-6 flex flex-col gap-4"
          >
            {tab === 'register' && (
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  Display Name
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  placeholder="How you appear to other players"
                  required
                  minLength={2}
                  maxLength={20}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2.5 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-violet-500"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@email.com"
                required
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2.5 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-violet-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={8}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2.5 pr-10 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-violet-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              {tab === 'login' && (
                <div className="text-right mt-1.5">
                  <a href="/forgot-password" className="text-xs text-violet-400 hover:text-violet-300">
                    Forgot password?
                  </a>
                </div>
              )}
            </div>

            {error && (
              <p className="text-red-400 text-sm text-center bg-red-950/30 border border-red-800/40 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-2.5 rounded-lg text-sm transition-colors mt-1"
            >
              {loading ? 'Please wait…' : tab === 'login' ? 'Sign In →' : 'Create Account →'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `app/login/page.tsx`**

```typescript
// app/login/page.tsx
import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import AuthCard from '@/components/auth/AuthCard';

export default async function LoginPage() {
  const session = await auth();
  if (session) redirect('/lobby');

  return (
    <Suspense>
      <AuthCard />
    </Suspense>
  );
}
```

- [ ] **Step 3: Add `SessionProvider` to `app/layout.tsx`**

Create `components/providers/SessionProvider.tsx`:

```typescript
// components/providers/SessionProvider.tsx
'use client';
import { SessionProvider } from 'next-auth/react';

export default function NextAuthSessionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SessionProvider>{children}</SessionProvider>;
}
```

Update `app/layout.tsx` — add import and wrap children:

```typescript
// app/layout.tsx
import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { Toaster } from 'react-hot-toast';
import SocketProvider from '@/components/providers/SocketProvider';
import NextAuthSessionProvider from '@/components/providers/SessionProvider';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: '3 of Spades | Kali Teeri',
  description: 'Multiplayer trick-taking card game — bid, choose trump, reveal partners, win tricks.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-slate-950 text-white min-h-screen`}
      >
        <NextAuthSessionProvider>
          <SocketProvider>
            {children}
          </SocketProvider>
        </NextAuthSessionProvider>
        <Toaster
          position="top-center"
          toastOptions={{
            style: { background: '#1e293b', color: '#f1f5f9', border: '1px solid #334155' },
            duration: 3000,
          }}
        />
      </body>
    </html>
  );
}
```

- [ ] **Step 4: Build check**

```bash
npm run build
```

Expected: no TypeScript errors.

- [ ] **Step 5: Manual test — visit http://localhost:3000/login**

Start dev server (`npm run dev`), navigate to `/login`. Verify:
- Tab switcher between Sign In / Register
- Register a new user → redirects to `/lobby`
- Sign out (browser devtools → clear cookies → `authjs.session-token` deleted)
- Sign in with the registered user → redirects to `/lobby`
- Wrong password → shows "Invalid email or password."

- [ ] **Step 6: Commit**

```bash
git add components/auth/ components/providers/SessionProvider.tsx app/login/ app/layout.tsx
git commit -m "feat: login/register page with auth.js credentials + session provider"
```

---

## Task 7: Forgot / Reset Password

**Files:**
- Create: `lib/email.ts`
- Create: `app/api/auth/forgot-password/route.ts`
- Create: `app/api/auth/reset-password/route.ts`
- Create: `app/forgot-password/page.tsx`
- Create: `app/reset-password/[token]/page.tsx`

- [ ] **Step 1: Create `lib/email.ts`**

```typescript
// lib/email.ts
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.RESEND_FROM || 'noreply@example.com';
const BASE_URL = process.env.NEXTAUTH_URL || 'http://localhost:3000';

export async function sendPasswordResetEmail(toEmail: string, rawToken: string): Promise<void> {
  const resetUrl = `${BASE_URL}/reset-password/${rawToken}`;

  if (!process.env.RESEND_API_KEY) {
    // Local dev fallback — log the link instead of sending email
    console.log(`[EMAIL DEV] Password reset link for ${toEmail}:\n${resetUrl}`);
    return;
  }

  await resend.emails.send({
    from: FROM,
    to: toEmail,
    subject: '3 of Spades — Reset your password',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#7c3aed">3 of Spades ♠</h2>
        <p>Click the link below to reset your password. The link expires in 1 hour.</p>
        <p><a href="${resetUrl}" style="background:#7c3aed;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block">Reset Password</a></p>
        <p style="color:#666;font-size:12px">If you didn't request this, ignore this email.</p>
      </div>
    `,
  });
}
```

- [ ] **Step 2: Create `app/api/auth/forgot-password/route.ts`**

```typescript
// app/api/auth/forgot-password/route.ts
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db/prisma';
import { sendPasswordResetEmail } from '@/lib/email';

export async function POST(req: NextRequest) {
  const { email } = await req.json();
  if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });

  // Always return success to prevent user enumeration
  if (!user) return NextResponse.json({ ok: true });

  // Invalidate any existing unused tokens for this user
  await prisma.passwordResetToken.updateMany({
    where: { userId: user.id, used: false },
    data: { used: true },
  });

  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = await bcrypt.hash(rawToken, 10);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await prisma.passwordResetToken.create({
    data: { userId: user.id, tokenHash, expiresAt },
  });

  await sendPasswordResetEmail(user.email, rawToken);

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Create `app/api/auth/reset-password/route.ts`**

```typescript
// app/api/auth/reset-password/route.ts
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db/prisma';

export async function POST(req: NextRequest) {
  const { token, password } = await req.json();
  if (!token || !password) return NextResponse.json({ error: 'Token and password required' }, { status: 400 });
  if (password.length < 8) return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });

  // Find a valid (unused, unexpired) token that matches
  const resetTokens = await prisma.passwordResetToken.findMany({
    where: { used: false, expiresAt: { gt: new Date() } },
    include: { user: true },
  });

  let matchedToken = null;
  for (const t of resetTokens) {
    const match = await bcrypt.compare(token, t.tokenHash);
    if (match) { matchedToken = t; break; }
  }

  if (!matchedToken) {
    return NextResponse.json({ error: 'Invalid or expired reset link.' }, { status: 400 });
  }

  const newHash = await bcrypt.hash(password, 12);
  await prisma.$transaction([
    prisma.user.update({ where: { id: matchedToken.userId }, data: { passwordHash: newHash } }),
    prisma.passwordResetToken.update({ where: { id: matchedToken.id }, data: { used: true } }),
  ]);

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Create `app/forgot-password/page.tsx`**

```typescript
// app/forgot-password/page.tsx
'use client';
import { useState } from 'react';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    setLoading(false);
    setSent(true);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-5xl mb-2">♠</div>
          <h1 className="text-xl font-black text-white">Reset Password</h1>
        </div>
        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6">
          {sent ? (
            <div className="text-center">
              <div className="text-3xl mb-3">📧</div>
              <p className="text-slate-300 text-sm">
                If that email is registered, we&apos;ve sent a reset link. Check your inbox (and spam).
              </p>
              <p className="text-slate-500 text-xs mt-2">
                For local dev — check the server console for the link.
              </p>
              <Link href="/login" className="block mt-4 text-violet-400 text-sm hover:text-violet-300">
                ← Back to Sign In
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <p className="text-slate-400 text-sm">
                Enter your email and we&apos;ll send a password reset link.
              </p>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  placeholder="you@email.com"
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2.5 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-violet-500"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-bold py-2.5 rounded-lg text-sm transition-colors"
              >
                {loading ? 'Sending…' : 'Send Reset Link'}
              </button>
              <Link href="/login" className="text-center text-slate-500 text-xs hover:text-slate-300">
                ← Back to Sign In
              </Link>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Create `app/reset-password/[token]/page.tsx`**

```typescript
// app/reset-password/[token]/page.tsx
'use client';
import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

export default function ResetPasswordPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setLoading(true);
    setError('');
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error); return; }
    setDone(true);
    setTimeout(() => router.push('/login'), 2000);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-5xl mb-2">♠</div>
          <h1 className="text-xl font-black text-white">New Password</h1>
        </div>
        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6">
          {done ? (
            <div className="text-center">
              <div className="text-3xl mb-3">✅</div>
              <p className="text-slate-300 text-sm">Password updated! Redirecting to sign in…</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">New Password</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} placeholder="Min. 8 characters" className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2.5 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-violet-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Confirm Password</label>
                <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required placeholder="Repeat password" className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2.5 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-violet-500" />
              </div>
              {error && <p className="text-red-400 text-sm bg-red-950/30 border border-red-800/40 rounded-lg px-3 py-2">{error}</p>}
              <button type="submit" disabled={loading} className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-bold py-2.5 rounded-lg text-sm transition-colors">
                {loading ? 'Updating…' : 'Update Password'}
              </button>
              <Link href="/login" className="text-center text-slate-500 text-xs hover:text-slate-300">← Back to Sign In</Link>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Build check**

```bash
npm run build
```

Expected: builds without errors.

- [ ] **Step 7: Manual test — forgot password (local dev)**

With dev server running:
1. Visit http://localhost:3000/forgot-password
2. Enter `test@test.com`, submit
3. Check server console for the reset link (e.g. `http://localhost:3000/reset-password/abc123...`)
4. Visit that URL, enter new password, submit
5. Verify redirect to `/login`
6. Sign in with new password — should succeed

- [ ] **Step 8: Commit**

```bash
git add lib/email.ts app/api/auth/forgot-password/ app/api/auth/reset-password/ app/forgot-password/ app/reset-password/
git commit -m "feat: forgot/reset password flow with Resend email (console fallback in dev)"
```

---

## Task 8: Middleware Route Protection

**Files:**
- Create: `middleware.ts` (project root)

- [ ] **Step 1: Create `middleware.ts`**

```typescript
// middleware.ts
export { auth as middleware } from '@/auth';

export const config = {
  matcher: [
    // List every protected path explicitly — simpler and less error-prone
    '/lobby',
    '/lobby/:path*',
    '/room/:path*',
    '/game/:path*',
    '/profile',
    '/profile/:path*',
    '/leaderboard',
  ],
};
```

> **Note:** Auth.js v5 exports `auth` which, when used as middleware, automatically handles the redirect to `pages.signIn` (`/login`) for unauthenticated requests matching the above paths.

- [ ] **Step 2: Build check**

```bash
npm run build
```

Expected: builds without errors.

- [ ] **Step 3: Manual test — protected routes redirect**

With dev server running (no session / after clearing cookies):
- Visit http://localhost:3000/lobby → should redirect to `/login?callbackUrl=/lobby`
- Visit http://localhost:3000/game/anything → should redirect to `/login`
- Visit http://localhost:3000/login → should load normally (not redirect)

After signing in:
- Visit http://localhost:3000/login → should redirect to `/lobby` (already handled in `app/login/page.tsx`)

- [ ] **Step 4: Commit**

```bash
git add middleware.ts
git commit -m "feat: middleware route protection — redirect unauthenticated users to /login"
```

---

## Task 9: Socket Handshake Auth (Server Side)

**Files:**
- Modify: `server.ts`
- Modify: `lib/socket/socketClient.ts`

- [ ] **Step 1: Update `lib/socket/socketClient.ts` — add `withCredentials`**

Change the `io()` call in `getSocket()`:

```typescript
// lib/socket/socketClient.ts  — change the io() options only
socket = io({
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  withCredentials: true,  // ← ADD THIS — sends the httpOnly cookie with socket upgrade
});
```

- [ ] **Step 2: Add Socket.IO auth middleware to `server.ts`**

Add this block after `initSocketServer(io)` and before `httpServer.listen(...)`:

```typescript
// server.ts — add these imports at top
import { decode } from 'next-auth/jwt';
import { parse as parseCookies } from 'cookie';

// ...existing code...

// After: initSocketServer(io);
// Add: Socket.IO auth middleware — extracts userId from NextAuth JWT cookie

io.use(async (socket, next) => {
  try {
    const cookieHeader = socket.request.headers.cookie || '';
    const cookies = parseCookies(cookieHeader);
    
    // Auth.js v5 cookie name (dev: authjs.session-token, prod: __Secure-authjs.session-token)
    const sessionToken =
      cookies['authjs.session-token'] ||
      cookies['__Secure-authjs.session-token'];

    if (!sessionToken) {
      // No session — allow connection but socket.data.userId will be undefined
      // Guest connections are still rejected at the room:create / room:join handler level
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
    next(); // Don't block the socket on auth errors
  }
});
```

Also add `cookie` package:

```bash
npm install cookie
npm install -D @types/cookie
```

- [ ] **Step 3: Build check**

```bash
npm run build
```

Expected: builds without errors.

- [ ] **Step 4: Verify socket gets userId — add temporary debug log**

In `lib/socket/socketServer.ts`, in the `io.on('connection', ...)` handler, temporarily add:

```typescript
console.log('[socket connected] userId:', socket.data.userId ?? 'NONE');
```

Start dev server, sign in, navigate to `/lobby` — server console should log `[socket connected] userId: <uuid>`.

Remove the debug log after verifying.

- [ ] **Step 5: Commit**

```bash
git add server.ts lib/socket/socketClient.ts package.json package-lock.json
git commit -m "feat: socket handshake reads nextauth jwt — populates socket.data.userId"
```

---

## Task 10: Update Reconnect Flow — userId-based

**Files:**
- Modify: `lib/socket/socketServer.ts`
- Modify: `hooks/useSocket.ts`
- Modify: `store/playerStore.ts`

- [ ] **Step 1: Update `store/playerStore.ts` — add `userId`, keep `roomId`**

```typescript
// store/playerStore.ts
'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface PlayerStore {
  userId: string | null;       // persistent DB id (from session)
  playerId: string | null;     // in-room seat id (= userId after auth migration)
  playerName: string;
  roomId: string | null;
  setUserId: (id: string) => void;
  setPlayerId: (id: string) => void;
  setPlayerName: (name: string) => void;
  setRoomId: (id: string | null) => void;
  clear: () => void;
}

export const usePlayerStore = create<PlayerStore>()(
  persist(
    (set) => ({
      userId: null,
      playerId: null,
      playerName: '',
      roomId: null,
      setUserId: (id) => set({ userId: id }),
      setPlayerId: (id) => set({ playerId: id }),
      setPlayerName: (name) => set({ playerName: name }),
      setRoomId: (id) => set({ roomId: id }),
      clear: () => set({ userId: null, playerId: null, playerName: '', roomId: null }),
    }),
    { name: 'kali-teeri-player' }
  )
);
```

- [ ] **Step 2: Update `hooks/useSocket.ts` — reconnect uses `userId`**

In the `socket.on('connect', ...)` handler, update the reconnect emit:

```typescript
// hooks/useSocket.ts — update the 'connect' handler block only
socket.on('connect', () => {
  setConnected(true);
  setConnecting(false);

  // Re-attach to an in-progress room after reconnect
  // Now uses userId (persistent) instead of localStorage playerId
  const { userId, roomId: storedRoomId } = usePlayerStore.getState();
  if (userId && storedRoomId) {
    socket.emit('player:reconnect', {
      roomId: storedRoomId,
      playerId: userId,   // send userId as playerId — server matches on this
    });
  }
});
```

- [ ] **Step 3: Update `lib/socket/socketServer.ts` — `player:reconnect` and `room:create` / `room:join` use `socket.data.userId`**

Find the `room:create` handler (around line 755). After the room is created and player added, update the emit to include the player's `userId` and also ensure `player.id` is set to `socket.data.userId` if available:

```typescript
// In room:create handler — change how playerId is determined:
// Before: const playerId = uuidv4();
// After:
const playerId = socket.data.userId ?? uuidv4();
```

Apply the same change to `room:join`:
```typescript
// In room:join handler:
const playerId = socket.data.userId ?? uuidv4();
```

In the `player:reconnect` handler, also store `socket.data.userId` for session persistence:
```typescript
// In player:reconnect handler, after finding the player:
socket.data.userId = player.id; // ensure it's always set after reconnect
```

- [ ] **Step 4: Build check**

```bash
npm run build
```

Expected: no TypeScript errors.

- [ ] **Step 5: Manual test — cross-device reconnect**

1. Sign in on Chrome, create a room, start a game
2. Note the room code
3. Sign in on Firefox (same account) — navigate to `/room/<code>` or the game URL
4. Socket should reconnect: server console logs `player:reconnect` with the userId
5. Player restored to their seat

- [ ] **Step 6: Commit**

```bash
git add store/playerStore.ts hooks/useSocket.ts lib/socket/socketServer.ts
git commit -m "feat: cross-device reconnect — socket and room join use persistent userId"
```

---

## Task 11: Update Lobby — Pre-fill Name from Session

**Files:**
- Modify: `app/lobby/page.tsx`
- Modify: `app/page.tsx`

- [ ] **Step 1: In `app/lobby/page.tsx`, read session and pre-fill player name**

Find where `playerName` is used in the create/join form. Add session reading at the top of the component:

```typescript
// app/lobby/page.tsx — add at top of component (server component or client)
// If lobby/page.tsx is a server component, add:
import { auth } from '@/auth';

// Inside the page component:
const session = await auth();
const sessionName = session?.user?.name ?? '';
```

Pass `sessionName` as the default value for the player name input in both `CreateRoom` and `JoinRoom` components — so logged-in users don't need to type their name again.

The exact implementation depends on whether `app/lobby/page.tsx` is a server or client component. Read the file first:

```bash
# Check the first line to determine component type
Select-String "'use client'" app/lobby/page.tsx
```

If it's a **server component** (no `'use client'`): use `await auth()` directly.  
If it's a **client component**: use `useSession()` from `next-auth/react` and read `session.user.name`.

- [ ] **Step 2: Update `app/page.tsx` — remove "works fully offline, no account needed" copy**

Find and delete or replace this line:
```tsx
<p className="text-slate-700 text-xs">Works fully offline — no account, no internet needed</p>
```

Replace with:
```tsx
<p className="text-slate-500 text-xs">Create a free account to play and track your stats</p>
```

- [ ] **Step 3: Build check**

```bash
npm run build
```

Expected: no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add app/lobby/page.tsx app/page.tsx
git commit -m "feat: pre-fill player name from session in lobby; update homepage copy"
```

---

## Task 12: Final Build, Smoke Test & Plan-2 Prep

- [ ] **Step 1: Full build**

```bash
npm run build
```

Expected: all routes compile, zero TypeScript errors.

- [ ] **Step 2: End-to-end smoke test checklist**

With `npm run dev` running:

| Check | Expected |
|---|---|
| Visit `/lobby` unauthenticated | Redirects to `/login?callbackUrl=/lobby` |
| Register new account | Redirects to `/lobby` |
| Sign out (clear `authjs.session-token` cookie) | Session gone |
| Sign in | Redirects to `/lobby` |
| Forgot password | Console logs reset link (no Resend key needed) |
| Reset password via link | Password updated, redirect to `/login` |
| Create room | Player name pre-filled from session |
| Start game | Game works as before |
| Reconnect from same device | Works via userId |

- [ ] **Step 3: Verify `.gitignore` has all correct entries**

```
.env.local
node_modules/
.next/
```

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat(auth-plan1): complete auth foundation — nextauth, prisma, middleware, socket userid, reconnect"
```

---

## Troubleshooting

**`AUTH_SECRET` not found errors:** Ensure `.env.local` is in project root (not `prisma/`) and contains `AUTH_SECRET=...`

**Prisma client not found after install:** Run `npx prisma generate` to regenerate the client after schema changes.

**Socket not sending cookie:** Ensure `withCredentials: true` is set in `socketClient.ts` AND the Socket.IO CORS config in `server.ts` has `credentials: true` (it already does).

**`authjs.session-token` cookie not set:** Check that `NEXTAUTH_URL` matches the URL you're visiting (e.g., `http://localhost:3000` not `http://0.0.0.0:3000`).

**`decode` returns null:** The cookie salt must match exactly. In dev it's `authjs.session-token`, in prod (HTTPS) it's `__Secure-authjs.session-token`.
