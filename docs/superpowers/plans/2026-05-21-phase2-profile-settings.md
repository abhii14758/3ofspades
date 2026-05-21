# Phase 2: Enhanced Profile & Settings — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add larger avatars, card back cosmetics, table themes, emote wheel, and general preferences to the profile/settings page.

**Architecture:** Extend the existing `/profile` page with new tabs. Add config files for cosmetics. New Zustand store for client-side settings. Extend socket events to carry cosmetic data.

**Tech Stack:** React, Zustand, Socket.IO, Tailwind CSS, Prisma

---

### File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `config/cardBacks.ts` | Card back designs catalog |
| Create | `config/tableThemes.ts` | Table theme definitions |
| Create | `config/emotes.ts` | Emote definitions |
| Create | `store/settingsStore.ts` | Client-side preferences (localStorage) |
| Modify | `types/index.ts` | Add equippedCardBackId to Player, payload types |
| Modify | `components/profile/AvatarDisplay.tsx` | Support larger sizes (128px, 192px) |
| Modify | `components/profile/ProfileClient.tsx` | Add Cosmetics and Settings tabs |
| Modify | `lib/socket/socketServer.ts` | Add game:emote handler |
| Modify | `lib/socket/socketClient.ts` | Add emote emit helper |
| Modify | `hooks/useSocket.ts` | Add emote listener |
| Modify | `components/game/GameTable.tsx` | Apply table theme CSS |
| Create | `components/game/EmoteWheel.tsx` | Emote wheel overlay component |
| Modify | `components/game/PlayerSeat.tsx` | Show emote overlay |
| Modify | `store/gameStore.ts` | Track active emotes for display |
| Modify | `app/api/profile/route.ts` | Handle new cosmetic fields in PATCH |

---

### Task 1: Create cosmetics config files

**Files:**
- Create: `config/cardBacks.ts`
- Create: `config/tableThemes.ts`
- Create: `config/emotes.ts`

- [ ] **Step 1: Create cardBacks.ts**

```typescript
export interface CardBack {
  id: string;
  label: string;
  gradient: string;
  pattern: string; // CSS background pattern or emoji
}

export const CARD_BACKS: CardBack[] = [
  { id: 'default',  label: 'Classic',   gradient: 'from-red-800 to-red-950',       pattern: '♠' },
  { id: 'midnight', label: 'Midnight',  gradient: 'from-indigo-800 to-slate-950',   pattern: '🌙' },
  { id: 'royal',    label: 'Royal',     gradient: 'from-purple-800 to-purple-950',  pattern: '♛' },
  { id: 'neon',     label: 'Neon',      gradient: 'from-green-500 to-emerald-900',  pattern: '⚡' },
  { id: 'galaxy',   label: 'Galaxy',    gradient: 'from-violet-600 to-indigo-950',  pattern: '🌌' },
  { id: 'gold',     label: 'Gold Rush', gradient: 'from-yellow-600 to-amber-900',   pattern: '✦' },
  { id: 'frost',    label: 'Frost',     gradient: 'from-cyan-400 to-blue-900',      pattern: '❄' },
  { id: 'shadow',   label: 'Shadow',    gradient: 'from-gray-700 to-gray-950',      pattern: '♟' },
  { id: 'cherry',   label: 'Cherry',    gradient: 'from-pink-600 to-rose-950',      pattern: '♥' },
  { id: 'forest',   label: 'Forest',    gradient: 'from-green-800 to-green-950',    pattern: '♣' },
  { id: 'ocean',    label: 'Ocean',     gradient: 'from-blue-500 to-blue-950',      pattern: '♦' },
  { id: 'ember',    label: 'Ember',     gradient: 'from-orange-600 to-red-950',     pattern: '🔥' },
];

export function getCardBack(id: string): CardBack {
  return CARD_BACKS.find(cb => cb.id === id) ?? CARD_BACKS[0];
}
```

- [ ] **Step 2: Create tableThemes.ts**

```typescript
export interface TableTheme {
  id: string;
  label: string;
  bg: string;       // Tailwind gradient classes or CSS
  borderColor: string;
  feltColor: string; // For table surface
}

export const TABLE_THEMES: TableTheme[] = [
  { id: 'default', label: 'Green Felt',   bg: 'from-green-950 to-green-900',    borderColor: 'border-green-800', feltColor: '#1a472a' },
  { id: 'midnight', label: 'Midnight Blue', bg: 'from-blue-950 to-indigo-900',  borderColor: 'border-blue-800',  feltColor: '#0f1b3d' },
  { id: 'royal',   label: 'Royal Purple', bg: 'from-purple-950 to-violet-900', borderColor: 'border-purple-800', feltColor: '#2d1b4e' },
  { id: 'sunset',  label: 'Sunset',       bg: 'from-orange-950 to-red-900',    borderColor: 'border-orange-800', feltColor: '#3d1a0a' },
  { id: 'noir',    label: 'Noir',         bg: 'from-gray-950 to-slate-900',    borderColor: 'border-gray-700',   feltColor: '#111827' },
  { id: 'arctic',  label: 'Arctic',       bg: 'from-cyan-950 to-slate-900',    borderColor: 'border-cyan-800',   feltColor: '#0c2d3e' },
];

export function getTableTheme(id: string): TableTheme {
  return TABLE_THEMES.find(t => t.id === id) ?? TABLE_THEMES[0];
}
```

- [ ] **Step 3: Create emotes.ts**

```typescript
export interface Emote {
  id: string;
  label: string;
  emoji: string;
}

export const ALL_EMOTES: Emote[] = [
  { id: 'gg',          label: 'GG',          emoji: '🤝' },
  { id: 'nice',        label: 'Nice Play',   emoji: '👏' },
  { id: 'oops',        label: 'Oops',        emoji: '😅' },
  { id: 'thinking',    label: 'Thinking',    emoji: '🤔' },
  { id: 'wow',         label: 'Wow',         emoji: '😮' },
  { id: 'goodluck',    label: 'Good Luck',   emoji: '🍀' },
  { id: 'thanks',      label: 'Thanks',      emoji: '🙏' },
  { id: 'hello',       label: 'Hello',       emoji: '👋' },
  { id: 'wp',          label: 'Well Played', emoji: '🏆' },
  { id: 'rush',        label: 'Hurry Up',    emoji: '⏰' },
  { id: 'deal',        label: 'Deal Me In',  emoji: '🃏' },
  { id: 'legendary',   label: 'Legendary',   emoji: '⭐' },
];

export const MAX_EQUIPPED_EMOTES = 8;

export function getEmote(id: string): Emote {
  return ALL_EMOTES.find(e => e.id === id) ?? ALL_EMOTES[0];
}
```

- [ ] **Step 4: Commit**

```bash
git add config/cardBacks.ts config/tableThemes.ts config/emotes.ts
git commit -m "feat: add cosmetics config — card backs, table themes, emotes"
```

---

### Task 2: Update types for cosmetics

**Files:**
- Modify: `types/index.ts`

- [ ] **Step 1: Add equippedCardBackId to Player interface**

In `types/index.ts`, add to the `Player` interface (after `equippedFrameId`):

```typescript
  equippedCardBackId?: string;
```

- [ ] **Step 2: Add equippedCardBackId to CreateRoomPayload and JoinRoomPayload**

In `CreateRoomPayload`:
```typescript
  equippedCardBackId?: string;
```

In `JoinRoomPayload`:
```typescript
  equippedCardBackId?: string;
```

- [ ] **Step 3: Commit**

```bash
git add types/index.ts
git commit -m "feat: add equippedCardBackId to Player and payload types"
```

---

### Task 3: Enlarge avatar display

**Files:**
- Modify: `components/profile/AvatarDisplay.tsx`

- [ ] **Step 1: Read current AvatarDisplay**

Read the file to understand current sizing.

- [ ] **Step 2: Add xl and 2xl size options**

The component currently accepts a `size` prop. Extend the size map to include 128px and 192px. Look at the existing size handling (likely `'sm' | 'md' | 'lg'`) and add:

```typescript
const sizeMap = {
  sm: 'w-6 h-6',       // 24px
  md: 'w-10 h-10',     // 40px
  lg: 'w-16 h-16',     // 64px
  xl: 'w-32 h-32',     // 128px
  '2xl': 'w-48 h-48',  // 192px
};
```

Also scale the inner emoji/image/icon proportionally for xl and 2xl.

- [ ] **Step 3: Update profile page to use xl size**

In `ProfileClient.tsx`, change the hero avatar from `size="lg"` (or whatever it is) to `size="2xl"` for the hero section.

- [ ] **Step 4: Commit**

```bash
git add components/profile/AvatarDisplay.tsx components/profile/ProfileClient.tsx
git commit -m "feat: add xl/2xl avatar sizes, enlarge profile hero avatar"
```

---

### Task 4: Create settings store

**Files:**
- Create: `store/settingsStore.ts`

- [ ] **Step 1: Write the settings store**

```typescript
'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsStore {
  soundVolume: number;    // 0-100
  musicVolume: number;    // 0-100
  muted: boolean;
  language: string;
  setSoundVolume: (v: number) => void;
  setMusicVolume: (v: number) => void;
  setMuted: (m: boolean) => void;
  setLanguage: (l: string) => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      soundVolume: 70,
      musicVolume: 50,
      muted: false,
      language: 'en',
      setSoundVolume: (v) => set({ soundVolume: v }),
      setMusicVolume: (v) => set({ musicVolume: v }),
      setMuted: (m) => set({ muted: m }),
      setLanguage: (l) => set({ language: l }),
    }),
    { name: 'kali-teeri-settings' }
  )
);
```

- [ ] **Step 2: Commit**

```bash
git add store/settingsStore.ts
git commit -m "feat: add settings store for client-side preferences"
```

---

### Task 5: Add Cosmetics and Settings tabs to profile

**Files:**
- Modify: `components/profile/ProfileClient.tsx`
- Modify: `app/api/profile/route.ts`

- [ ] **Step 1: Extend PATCH /api/profile to handle new fields**

In `app/api/profile/route.ts`, the PATCH handler already destructures cosmetic fields. Add `equippedCardBackId`, `equippedTableThemeId`, `equippedEmoteIds` to the allowed fields:

```typescript
const { displayName, bio, presetAvatarId, avatarType, avatarUrl, equippedFrameId, equippedCardBackId, equippedTableThemeId, equippedEmoteIds } = body;

// In the data object:
if (equippedCardBackId !== undefined) data.equippedCardBackId = equippedCardBackId;
if (equippedTableThemeId !== undefined) data.equippedTableThemeId = equippedTableThemeId;
if (equippedEmoteIds !== undefined) {
  if (!Array.isArray(equippedEmoteIds) || equippedEmoteIds.length > 8) {
    return NextResponse.json({ error: 'Max 8 emotes' }, { status: 400 });
  }
  data.equippedEmoteIds = equippedEmoteIds;
}
```

Also update the response to include new fields.

- [ ] **Step 2: Add Cosmetics tab to ProfileClient**

Add imports:
```typescript
import { CARD_BACKS, getCardBack } from '@/config/cardBacks';
import { TABLE_THEMES, getTableTheme } from '@/config/tableThemes';
import { ALL_EMOTES, MAX_EQUIPPED_EMOTES } from '@/config/emotes';
```

Add state:
```typescript
const [equippedCardBackId, setEquippedCardBackId] = useState('default');
const [equippedTableThemeId, setEquippedTableThemeId] = useState('default');
const [equippedEmoteIds, setEquippedEmoteIds] = useState<string[]>([]);
```

Extend the tab array from `['profile', 'stats', 'security']` to `['profile', 'cosmetics', 'stats', 'settings', 'security']`.

Add a **Cosmetics** tab section with three sub-sections:
1. Card Back grid — render `CARD_BACKS` as clickable cards, highlight selected with ring
2. Table Theme grid
3. Emote selector (checkboxes or toggle grid, max 8)

Save all via the existing `handleSaveProfile` by including the new fields in the PATCH body.

- [ ] **Step 3: Add Settings tab**

Add a **Settings** tab section with:
1. Sound volume slider (0-100)
2. Music volume slider (0-100)
3. Mute toggle
4. Language dropdown (just English for now)

Use `useSettingsStore` for these values. No API call needed — all localStorage.

- [ ] **Step 4: Commit**

```bash
git add components/profile/ProfileClient.tsx app/api/profile/route.ts
git commit -m "feat: add cosmetics and settings tabs to profile page"
```

---

### Task 6: Pass card back through socket events

**Files:**
- Modify: `lib/socket/socketServer.ts` (room:create, room:join player creation)
- Modify: `lib/socket/socketClient.ts` (emit helpers)
- Modify: `store/playerStore.ts` (add equippedCardBackId)
- Modify: `app/lobby/page.tsx` (pass equippedCardBackId)

- [ ] **Step 1: Add equippedCardBackId to playerStore**

In `store/playerStore.ts`, add to the interface:
```typescript
equippedCardBackId: string;
```

Add to initial state:
```typescript
equippedCardBackId: 'default',
```

Add to the `setAvatar` action or create a new setter — add it to the `setAvatar` data parameter:
```typescript
setAvatar: (data: { ...existing, equippedCardBackId?: string }) => void;
```

And in the setAvatar implementation:
```typescript
setAvatar: (data) => set(data),
```

Add `equippedCardBackId` to the `clear()` function reset.

- [ ] **Step 2: Pass through lobby createRoom/joinRoom**

In `app/lobby/page.tsx`, add to the store destructuring:
```typescript
const { ..., equippedCardBackId } = usePlayerStore();
```

And pass in emit calls:
```typescript
socketEmit.createRoom({ ..., equippedCardBackId });
socketEmit.joinRoom({ ..., equippedCardBackId });
```

- [ ] **Step 3: Update socketServer player creation**

In `socketServer.ts`, `room:create` handler player object, add:
```typescript
equippedCardBackId: payload.equippedCardBackId ?? 'default',
```

Same in `room:join` handler's new player creation.

- [ ] **Step 4: Commit**

```bash
git add store/playerStore.ts app/lobby/page.tsx lib/socket/socketServer.ts
git commit -m "feat: pass equippedCardBackId through socket events"
```

---

### Task 7: Implement emote wheel

**Files:**
- Create: `components/game/EmoteWheel.tsx`
- Modify: `lib/socket/socketServer.ts` (add game:emote handler)
- Modify: `lib/socket/socketClient.ts` (add emote emit)
- Modify: `hooks/useSocket.ts` (add emote listener)
- Modify: `store/gameStore.ts` (track active emotes)
- Modify: `components/game/PlayerSeat.tsx` (show emote overlay)

- [ ] **Step 1: Add emote emit to socketClient**

In `lib/socket/socketClient.ts`, add:
```typescript
  sendEmote: (roomId: string, emoteId: string) =>
    getSocket().emit('game:emote', { roomId, emoteId }),
```

- [ ] **Step 2: Add game:emote handler in socketServer**

In `lib/socket/socketServer.ts`, add a new handler inside `io.on('connection')`:

```typescript
    // ── game:emote ──────────────────────────────────────────────────────
    socket.on('game:emote', ({ roomId, emoteId }: { roomId: string; emoteId: string }) => {
      const info = socketToPlayer.get(socket.id);
      if (!info || info.roomId !== roomId) return;
      const room = rooms.get(roomId);
      if (!room) return;
      const player = room.players.find(p => p.id === info.playerId);
      if (!player) return;

      io.to(roomId).emit('game:emote', {
        playerId: info.playerId,
        playerName: player.name,
        emoteId,
      });
    });
```

- [ ] **Step 3: Track active emotes in gameStore**

In `store/gameStore.ts`, add to the interface:
```typescript
activeEmotes: Map<string, { emoteId: string; timestamp: number }>;
addEmote: (playerId: string, emoteId: string) => void;
```

Implementation:
```typescript
activeEmotes: new Map(),

addEmote: (playerId, emoteId) =>
  set((s) => {
    const map = new Map(s.activeEmotes);
    map.set(playerId, { emoteId, timestamp: Date.now() });
    // Auto-clear after 3 seconds (handled by consumer)
    return { activeEmotes: map };
  }),
```

Also reset `activeEmotes` in the `reset()` function.

- [ ] **Step 4: Add emote listener in useSocket**

In `hooks/useSocket.ts`:
```typescript
    socket.on('game:emote', ({ playerId, emoteId, playerName }: { playerId: string; emoteId: string; playerName: string }) => {
      useGameStore.getState().addEmote(playerId, emoteId);
      const emote = getEmote(emoteId);
      toast(`${playerName}: ${emote.emoji}`, { duration: 2000 });
    });
```

Add import:
```typescript
import { getEmote } from '@/config/emotes';
```

Add cleanup:
```typescript
socket.off('game:emote');
```

- [ ] **Step 5: Create EmoteWheel component**

```typescript
'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ALL_EMOTES, getEmote } from '@/config/emotes';
import { socketEmit } from '@/lib/socket/socketClient';

interface EmoteWheelProps {
  roomId: string;
  equippedEmoteIds: string[];
}

export default function EmoteWheel({ roomId, equippedEmoteIds }: EmoteWheelProps) {
  const [open, setOpen] = useState(false);

  const emotes = equippedEmoteIds
    .map(id => getEmote(id))
    .filter(Boolean);

  const handleEmote = (emoteId: string) => {
    socketEmit.sendEmote(roomId, emoteId);
    setOpen(false);
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <button
        onClick={() => setOpen(!open)}
        className="w-12 h-12 rounded-full bg-slate-800 border border-slate-600 flex items-center justify-center text-xl hover:bg-slate-700 transition-colors shadow-lg"
      >
        😄
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 10 }}
            className="absolute bottom-16 right-0 bg-slate-900 border border-slate-700 rounded-2xl p-3 shadow-2xl"
          >
            <div className="grid grid-cols-4 gap-2">
              {emotes.map(emote => (
                <button
                  key={emote.id}
                  onClick={() => handleEmote(emote.id)}
                  className="w-12 h-12 rounded-xl bg-slate-800 hover:bg-slate-700 flex flex-col items-center justify-center transition-colors"
                  title={emote.label}
                >
                  <span className="text-lg">{emote.emoji}</span>
                  <span className="text-[9px] text-slate-400 truncate max-w-[44px]">{emote.label}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
```

- [ ] **Step 6: Add emote overlay to PlayerSeat**

In `components/game/PlayerSeat.tsx`, show the active emote briefly when it arrives. Use `useGameStore` to check `activeEmotes` for the player's ID, and auto-clear after 3 seconds.

- [ ] **Step 7: Wire EmoteWheel into game page**

In `app/game/[roomId]/page.tsx`, render `EmoteWheel` when gameState exists, passing `roomId` and the player's equipped emotes (from their profile data or from the player store).

- [ ] **Step 8: Commit**

```bash
git add components/game/EmoteWheel.tsx components/game/PlayerSeat.tsx lib/socket/socketServer.ts lib/socket/socketClient.ts hooks/useSocket.ts store/gameStore.ts app/game/[roomId]/page.tsx
git commit -m "feat: emote wheel with socket broadcast and seat overlay"
```

---

### Task 8: Apply table theme to game

**Files:**
- Modify: `components/game/GameTable.tsx`

- [ ] **Step 1: Read GameTable to understand current styling**

Read the file and find where the table background/gradient is applied.

- [ ] **Step 2: Apply player's table theme**

Import `useSettingsStore` or read the table theme from the player's profile data. Apply the theme's `feltColor` as the background of the game table area.

Since table theme is client-side only (each player sees their own), read from `playerStore` or a prop:

```typescript
const tableTheme = getTableTheme(equippedTableThemeId);
// Apply to the main table div:
style={{ background: tableTheme.feltColor }}
```

- [ ] **Step 3: Commit**

```bash
git add components/game/GameTable.tsx
git commit -m "feat: apply player's table theme to game table"
```

---

### Task 9: Create cosmetics API endpoint

**Files:**
- Create: `app/api/cosmetics/route.ts`

- [ ] **Step 1: Write the endpoint**

```typescript
import { NextResponse } from 'next/server';
import { CARD_BACKS } from '@/config/cardBacks';
import { TABLE_THEMES } from '@/config/tableThemes';
import { ALL_EMOTES } from '@/config/emotes';

export async function GET() {
  return NextResponse.json({
    cardBacks: CARD_BACKS,
    tableThemes: TABLE_THEMES,
    emotes: ALL_EMOTES,
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/cosmetics/route.ts
git commit -m "feat: add GET /api/cosmetics catalog endpoint"
```
