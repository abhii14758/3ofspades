# 3 of Spades UI Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 4 bugs (deal animation, cards during bidding, hide/show, share link) and perform a complete premium casino UI redesign with full mobile responsiveness.

**Architecture:** All changes are isolated to the frontend React layer. Zero changes to game engine, socket events, or Zustand stores. Tasks 1–4 are surgical bug fixes; Tasks 5–6 are visual/layout enhancements on top of the fixed foundation.

**Tech Stack:** Next.js 15, React, Tailwind CSS v4, Framer Motion, Zustand, TypeScript. Deployed on Railway.app.

**Spec:** `docs/superpowers/specs/2026-05-12-ui-overhaul-design.md`

---

## Task 1 — Fix Share Link (Railway Deployment)

**Files:**
- Modify: `app/room/[roomId]/page.tsx` lines 76–78, 277

---

- [ ] **Step 1.1 — Replace hardcoded LAN IP with `window.location.origin`**

In `app/room/[roomId]/page.tsx`, replace lines 76–78:

```ts
// REMOVE these three lines:
const LAN_IP = '192.168.3.112';
const port = typeof window !== 'undefined' ? window.location.port : '3000';
const shareLink = `http://${LAN_IP}:${port || '3000'}/room/${roomId}`;

// REPLACE WITH (single line, SSR-safe):
const shareLink = typeof window !== 'undefined'
  ? `${window.location.origin}/room/${roomId}`
  : `/room/${roomId}`;
```

- [ ] **Step 1.2 — Update the "LAN" label in the share link card**

Find line ~277 in `app/room/[roomId]/page.tsx` and update:
```tsx
// REMOVE:
<p className="text-slate-500 text-[10px] uppercase tracking-[0.18em] mb-2 text-center">
  🔗 Share Link (LAN)
</p>

// REPLACE WITH:
<p className="text-slate-500 text-[10px] uppercase tracking-[0.18em] mb-2 text-center">
  🔗 Share Link
</p>
```

Also update the helper text at line ~295:
```tsx
// REMOVE:
<p className="text-slate-600 text-[10px] text-center">
  Players on the same Wi-Fi can click this link to join directly

// REPLACE WITH:
<p className="text-slate-600 text-[10px] text-center">
  Share this link for others to join directly
```

- [ ] **Step 1.3 — TypeScript check**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 1.4 — Commit**

```bash
git add app/room/[roomId]/page.tsx
git commit -m "fix: share link uses window.location.origin instead of hardcoded LAN IP

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 2 — Fix Deal Animation Lingering

**Files:**
- Modify: `components/game/GameTable.tsx` lines 108–113, 125, 156

---

- [ ] **Step 2.1 — Simplify ROUNDS/clampedRounds to a single `cardsPerPlayer` value**

In `components/game/GameTable.tsx`, find lines 108–113 inside `DealAnimation` and replace:

```ts
// REMOVE these lines (108-113):
const N = players.length;
// Cap animation at ~13s worth of cards (≈46 cards at 0.28s each)
const ROUNDS = Math.min(cardsPerPlayer, Math.floor(13 / (N * DEAL_INTERVAL)));
const clampedRounds = Math.max(ROUNDS, cardsPerPlayer); // always do all rounds
const totalCards = N * clampedRounds;
const totalDuration = totalCards * DEAL_INTERVAL;

// REPLACE WITH:
const N = players.length;
const ROUNDS = cardsPerPlayer; // deal all cards — no cap
const totalCards = N * ROUNDS;
const totalDuration = totalCards * DEAL_INTERVAL;
```

- [ ] **Step 2.2 — Update all references from `clampedRounds` to `ROUNDS`**

In `DealAnimation`, there are two `clampedRounds` references to update:

**Timers useEffect (line ~125):**
```ts
// FIND:
for (let round = 0; round < clampedRounds; round++) {
// REPLACE:
for (let round = 0; round < ROUNDS; round++) {
```

**Also update the dependency array (line ~136):**
```ts
// FIND:
}, [players, myPlayerId, N, clampedRounds, onCardDealtToMe]);
// REPLACE:
}, [players, myPlayerId, N, ROUNDS, onCardDealtToMe]);
```

**Cards useMemo (line ~156):**
```ts
// FIND:
for (let round = 0; round < clampedRounds; round++) {
// REPLACE:
for (let round = 0; round < ROUNDS; round++) {
```

**Cards useMemo dependency array (line ~167):**
```ts
// FIND:
}, [N, clampedRounds]);
// REPLACE:
}, [N, ROUNDS]);
```

- [ ] **Step 2.3 — TypeScript check**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 2.4 — Commit**

```bash
git add components/game/GameTable.tsx
git commit -m "fix: deal animation always runs all cardsPerPlayer rounds without capping

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 3 — Fix Hand Hide/Show

**Files:**
- Modify: `components/game/GameTable.tsx` line ~950

---

- [ ] **Step 3.1 — Remove the phase guard from the hidden overlay condition**

In `components/game/GameTable.tsx`, find the hidden overlay condition (line ~950):

```tsx
// FIND:
{handHidden && !(isMyTurn && phase === 'playing') && (
  <div className="absolute inset-0 flex items-center justify-center gap-2 flex-wrap px-4 py-3"
    style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.97) 0%, rgba(0,0,0,0.85) 100%)' }}>
    {myHand.map((_, i) => (
      <div key={i} style={{
        width: 44, height: 64, borderRadius: 8,
        background: 'linear-gradient(145deg, #1a2850 0%, #1e3570 55%, #243f8a 100%)',
        border: '1px solid rgba(100,140,255,0.5)',
      }} />
    ))}
    <p className="w-full text-center text-[11px] text-slate-500 mt-1">Cards hidden — tap 👁️ to reveal</p>
  </div>
)}

// REPLACE WITH:
{handHidden && (
  <div className="absolute inset-0 flex items-center justify-center gap-1.5 flex-wrap px-4 py-3 z-10"
    style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.97) 0%, rgba(0,0,0,0.85) 100%)' }}>
    {myHand.map((_, i) => (
      <div key={i} style={{
        width: 44, height: 64, borderRadius: 8,
        background: 'linear-gradient(145deg, #1a2850 0%, #1e3570 55%, #243f8a 100%)',
        border: '1px solid rgba(100,140,255,0.5)',
        boxShadow: '0 4px 12px rgba(0,0,0,0.6)',
      }} />
    ))}
    <p className="w-full text-center text-[11px] text-slate-500 mt-1">Cards hidden — tap 👁️ to reveal</p>
  </div>
)}
```

The auto-reveal effect (`useEffect` at line ~536) already handles force-showing on your play turn — no other changes needed.

- [ ] **Step 3.2 — TypeScript check**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 3.3 — Commit**

```bash
git add components/game/GameTable.tsx
git commit -m "fix: hand hide overlay works in all phases, not just during play turn

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 4 — Fix BidPanel Covering Cards

**Files:**
- Modify: `components/game/GameTable.tsx` lines ~870–884

---

- [ ] **Step 4.1 — Move BidPanel out of `fixed inset-0` into a non-blocking position**

In `components/game/GameTable.tsx`, find the BidPanel wrapper (lines ~869–884):

```tsx
// FIND:
{/* ── Bid panel — centered dialog overlay ── */}
{showBidPanel && (
  <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
    <div className="pointer-events-auto w-full max-w-sm mx-4">
      <BidPanel
        bidState={bidState!}
        players={players}
        myPlayerId={myPlayerId}
        isMyTurn={bidState?.currentBidderId === myPlayerId}
        onBid={onBid ?? (() => {})}
        onPass={onPass ?? (() => {})}
        maxBid={maxBid}
      />
    </div>
  </div>
)}
```

The bid panel is rendered BETWEEN the table area `</div>` and the card hand `<div>`. Move it so it sits INSIDE the table area div. 

First, locate the closing `</div>` of the table area block (the block that starts at line ~636: `<div className="flex-1 relative flex items-center justify-center overflow-hidden min-h-0 p-1"`). The structure is:

```
<div className="flex-1 relative flex items-center justify-center overflow-hidden min-h-0 p-1">  ← TABLE AREA
  ... lamp glows ...
  <motion.div ref={tableRef} ...>   ← CASINO TABLE
    ... table layers, player seats, deal animation ...
  </motion.div>
</div>                                                                                            ← END TABLE AREA
                                                                                                 ← BidPanel is HERE (wrong!)
<div className="shrink-0 z-10 pt-1 pb-3">  ← CARD HAND
```

**Change 1:** Delete the current BidPanel block entirely (lines ~869–884).

**Change 2:** Add the BidPanel INSIDE the table area div, as an absolutely-positioned sibling AFTER the `<motion.div ref={tableRef}>...` block, but still inside the table area container. The table area div becomes:

```tsx
{/* ── Table area ────────────────────────────────────────────────────── */}
<div className="flex-1 relative flex items-center justify-center overflow-hidden min-h-0 p-1"
     style={{ background: 'radial-gradient(ellipse 80% 70% at 50% 40%, #0a0f0a 0%, #050808 60%, #020404 100%)' }}>

  {/* ... existing lamp glow divs ... */}

  {/* ── Casino Table ── */}
  <motion.div ref={tableRef} ...>
    {/* ... all table layers + player seats + deal animation ... */}
  </motion.div>

  {/* ── Bid panel — floats over table, does NOT block card hand ── */}
  {showBidPanel && (
    <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 z-20 flex justify-center pointer-events-none px-4">
      <div className="pointer-events-auto w-full max-w-sm">
        <BidPanel
          bidState={bidState!}
          players={players}
          myPlayerId={myPlayerId}
          isMyTurn={bidState?.currentBidderId === myPlayerId}
          onBid={onBid ?? (() => {})}
          onPass={onPass ?? (() => {})}
          maxBid={maxBid}
        />
      </div>
    </div>
  )}

</div>
```

The `absolute inset-x-0 top-1/2 -translate-y-1/2 z-20` positions the panel centered vertically within the table area — NOT over the card hand strip below.

- [ ] **Step 4.2 — TypeScript check**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 4.3 — Commit**

```bash
git add components/game/GameTable.tsx
git commit -m "fix: BidPanel positioned inside table area so cards are always visible during bidding

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 5 — Premium Casino Table Visual Enhancements

This task adds the missing decorative elements from the design spec to make the table look like the reference image: table legs, amber underside glow, player name plates in the rail, chip stack decorations, gold zone lines.

**Files:**
- Modify: `components/game/GameTable.tsx`
- Modify: `components/game/PlayerSeat.tsx`
- Modify: `components/game/TrickPile.tsx`
- Modify: `components/game/TurnIndicator.tsx`

---

### 5a — Table Legs + Amber Underside Glow

The table is tilted at `rotateX(18deg)`. Adding legs and glow below the table requires sibling elements OUTSIDE the `motion.div` that wraps the table, positioned within the same `flex items-center justify-center` table area container.

- [ ] **Step 5a.1 — Add table legs and amber glow below the casino table**

In `components/game/GameTable.tsx`, find the table area container. After the closing `</motion.div>` of the casino table (and before the BidPanel block you added in Task 4), add:

```tsx
{/* ── Table legs + underside glow (perspective effect) ── */}
<div
  className="absolute pointer-events-none"
  style={{
    left: '50%',
    transform: 'translateX(-50%)',
    bottom: 'calc(50% - min(26vh, 240px) - 30px)',
    width: 'min(80vw, 780px)',
    zIndex: 0,
  }}
>
  {/* Amber underside glow */}
  <div style={{
    position: 'absolute',
    left: '10%', right: '10%',
    top: 8,
    height: 40,
    borderRadius: '50%',
    background: 'radial-gradient(ellipse at 50% 0%, rgba(200,120,10,0.55) 0%, rgba(160,80,5,0.25) 40%, transparent 75%)',
    filter: 'blur(6px)',
  }} />
  {/* Four table legs */}
  {[{ left: '18%' }, { left: '36%' }, { left: '64%' }, { left: '82%' }].map((pos, i) => (
    <div
      key={i}
      style={{
        position: 'absolute',
        top: 0,
        left: pos.left,
        width: 18,
        height: 48,
        transform: 'translateX(-50%)',
        background: 'linear-gradient(180deg, #5a2008 0%, #2a0e04 50%, #0f0501 100%)',
        borderRadius: '0 0 4px 4px',
        boxShadow: '2px 0 6px rgba(0,0,0,0.7), -2px 0 6px rgba(0,0,0,0.5), inset 2px 0 4px rgba(255,160,60,0.07)',
      }}
    />
  ))}
</div>
```

- [ ] **Step 5a.2 — Add chip stack decorations at table corners (inside the `motion.div` table)**

Inside `components/game/GameTable.tsx`, inside the casino table `<motion.div ref={tableRef}>`, add chip stacks after the felt weave texture layer (after line ~735):

```tsx
{/* Decorative chip stacks at corners */}
{[
  { left: '12%', top: '22%', colors: ['#c0392b','#e74c3c','#c0392b','#922b21'] },
  { left: '88%', top: '22%', colors: ['#1a6b2a','#27ae60','#1a6b2a','#117a32'] },
  { left: '12%', top: '78%', colors: ['#d4a017','#f1c40f','#d4a017','#b8860b'] },
  { left: '88%', top: '78%', colors: ['#2471a3','#3498db','#2471a3','#1a5276'] },
].map((stack, si) => (
  <div
    key={si}
    className="absolute pointer-events-none"
    style={{ left: stack.left, top: stack.top, transform: 'translate(-50%,-50%)' }}
  >
    {stack.colors.map((color, ci) => (
      <div
        key={ci}
        style={{
          position: 'absolute',
          width: 18, height: 5,
          borderRadius: 3,
          background: color,
          top: ci * -4,
          left: 0,
          border: '0.5px solid rgba(255,255,255,0.15)',
          boxShadow: ci === 0 ? '0 2px 6px rgba(0,0,0,0.5)' : 'none',
        }}
      />
    ))}
  </div>
))}
```

- [ ] **Step 5a.3 — Add gold zone lines on felt**

Inside the casino table `<motion.div ref={tableRef}>`, add after the chip stacks:

```tsx
{/* Subtle gold zone lines on felt */}
<div className="absolute rounded-[50%] pointer-events-none" style={{
  inset: '52px',
  border: '1px solid rgba(212,160,23,0.18)',
  boxShadow: 'inset 0 0 0 1px rgba(212,160,23,0.08)',
}} />
```

- [ ] **Step 5a.4 — TypeScript check**

```bash
npx tsc --noEmit
```

Expected: zero errors.

### 5b — Enhanced PlayerSeat (Name Plates + Active Turn Styling)

- [ ] **Step 5b.1 — Enhance avatar ring and turn glow in PlayerSeat.tsx**

In `components/game/PlayerSeat.tsx`, update the avatar container (line ~195) to use a more premium look:

```tsx
// FIND:
<div style={{ padding: '3px', borderRadius: '50%', background: 'rgba(0,0,0,0.6)', boxShadow: '0 0 0 1px rgba(255,255,255,0.1), 0 4px 12px rgba(0,0,0,0.8)' }}>

// REPLACE WITH:
<div style={{
  padding: '3px',
  borderRadius: '50%',
  background: isCurrentTurn
    ? 'linear-gradient(135deg, rgba(34,197,94,0.25), rgba(0,0,0,0.8))'
    : 'rgba(0,0,0,0.7)',
  boxShadow: isCurrentTurn
    ? '0 0 0 2px rgba(34,197,94,0.7), 0 0 16px rgba(34,197,94,0.4), 0 4px 12px rgba(0,0,0,0.9)'
    : isPartner && isRevealed
    ? '0 0 0 2px rgba(52,211,153,0.6), 0 4px 12px rgba(0,0,0,0.8)'
    : '0 0 0 1px rgba(255,255,255,0.08), 0 4px 12px rgba(0,0,0,0.8)',
}}>
```

- [ ] **Step 5b.2 — Make name pill look like a premium plaque**

In `components/game/PlayerSeat.tsx`, update the name span (~line 241):

```tsx
// FIND:
<span
  className={clsx(
    'rounded-full bg-slate-900/80 border border-slate-700/60 text-slate-100 text-sm px-2 py-0.5 font-semibold max-w-[72px] truncate',
    isLocalPlayer ? 'text-sky-200' : 'text-slate-100',
    isDisconnected && 'line-through text-slate-500'
  )}
  title={player.name}
>
  {player.name}
</span>

// REPLACE WITH:
<span
  className={clsx(
    'rounded px-2 py-0.5 font-bold text-xs truncate max-w-[80px]',
    isLocalPlayer
      ? 'bg-sky-900/80 border border-sky-600/50 text-sky-200'
      : isCurrentTurn
      ? 'bg-green-950/90 border border-green-600/60 text-green-300'
      : 'text-slate-100',
    isDisconnected && 'line-through text-slate-500'
  )}
  style={!isLocalPlayer && !isCurrentTurn ? {
    background: 'linear-gradient(135deg, rgba(30,20,5,0.92), rgba(10,7,2,0.95))',
    border: '1px solid rgba(212,160,23,0.35)',
    boxShadow: '0 1px 4px rgba(0,0,0,0.5)',
  } : undefined}
  title={player.name}
>
  {player.name}
</span>
```

- [ ] **Step 5b.3 — TypeScript check**

```bash
npx tsc --noEmit
```

Expected: zero errors.

### 5c — Enhanced TrickPile

- [ ] **Step 5c.1 — Increase trick card size and winner glow**

In `components/game/TrickPile.tsx`, update the card size and winner styling (lines ~113–136):

```tsx
// FIND the inline card div style block:
style={{
  display: 'flex', flexDirection: 'column',
  alignItems: 'center', justifyContent: 'space-between',
  borderRadius: 8,
  width: 44, height: 64,
  background: '#ffffff',
  border: isWinner
    ? '2px solid #fde68a'
    : is3Spades
    ? '2px solid #d4a017'
    : isTrump
    ? '1.5px solid rgba(253,186,116,0.7)'
    : '1.5px solid #d0d0d0',
  boxShadow: isWinner
    ? '0 0 0 1px rgba(253,224,71,0.5), 0 0 18px rgba(253,224,71,0.7), 0 6px 16px rgba(0,0,0,0.6)'
    : is3Spades
    ? '0 0 14px rgba(212,160,23,0.6), 0 4px 12px rgba(0,0,0,0.5)'
    : isTrump
    ? '0 0 8px rgba(253,186,116,0.4), 0 4px 10px rgba(0,0,0,0.5)'
    : '0 4px 10px rgba(0,0,0,0.5)',
  padding: '3px 4px',
  overflow: 'hidden',
  position: 'relative',
}}

// REPLACE WITH:
style={{
  display: 'flex', flexDirection: 'column',
  alignItems: 'center', justifyContent: 'space-between',
  borderRadius: 8,
  width: 48, height: 68,
  background: '#ffffff',
  border: isWinner
    ? '2px solid #fde68a'
    : is3Spades
    ? '2px solid #d4a017'
    : isTrump
    ? '1.5px solid rgba(253,186,116,0.7)'
    : '1.5px solid #d0d0d0',
  boxShadow: isWinner
    ? '0 0 0 2px rgba(253,224,71,0.6), 0 0 24px rgba(253,224,71,0.8), 0 8px 20px rgba(0,0,0,0.7)'
    : is3Spades
    ? '0 0 18px rgba(212,160,23,0.7), 0 4px 14px rgba(0,0,0,0.6)'
    : isTrump
    ? '0 0 10px rgba(253,186,116,0.5), 0 4px 12px rgba(0,0,0,0.5)'
    : '0 4px 12px rgba(0,0,0,0.5)',
  padding: '3px 4px',
  overflow: 'hidden',
  position: 'relative',
  transform: isWinner ? 'translateY(-6px) scale(1.05)' : 'none',
  transition: 'transform 0.2s ease, box-shadow 0.2s ease',
}}
```

- [ ] **Step 5c.2 — TypeScript check**

```bash
npx tsc --noEmit
```

Expected: zero errors.

### 5d — Enhanced TurnIndicator (Premium Styling)

- [ ] **Step 5d.1 — Make TurnIndicator more prominent and visually rich**

In `components/game/TurnIndicator.tsx`, replace the "Your Turn" pill:

```tsx
// FIND (the isMyTurn branch):
{isMyTurn ? (
  <motion.div
    className="px-6 py-2 rounded-full bg-gradient-to-r from-green-600 to-emerald-600 text-white font-bold text-sm tracking-wide shadow-lg"
    initial={{ scale: 0.8 }}
    animate={{
      scale: [0.8, 1.05, 1],
      boxShadow: [
        '0 0 8px rgba(74,222,128,0.4)',
        '0 0 24px rgba(74,222,128,0.8)',
        '0 0 8px rgba(74,222,128,0.4)',
      ],
    }}
    transition={{
      scale: { duration: 0.5, times: [0, 0.6, 1] },
      boxShadow: { duration: 1.5, repeat: Infinity },
    }}
  >
    ✨ Your Turn!
  </motion.div>
) : (
  <div className="px-5 py-2 rounded-full bg-slate-800/90 border border-slate-600/60 shadow-md text-slate-300 text-sm">
    🎯 <span className="text-slate-100 font-semibold">{currentPlayer.name}</span>&apos;s Turn
  </div>
)}

// REPLACE WITH:
{isMyTurn ? (
  <motion.div
    className="px-5 py-1.5 rounded-full text-white font-bold text-sm tracking-wide"
    style={{
      background: 'linear-gradient(135deg, #16a34a 0%, #15803d 50%, #166534 100%)',
      border: '1px solid rgba(74,222,128,0.5)',
    }}
    initial={{ scale: 0.8 }}
    animate={{
      scale: [0.8, 1.04, 1],
      boxShadow: [
        '0 0 8px rgba(74,222,128,0.4), 0 2px 8px rgba(0,0,0,0.5)',
        '0 0 28px rgba(74,222,128,0.85), 0 2px 8px rgba(0,0,0,0.5)',
        '0 0 8px rgba(74,222,128,0.4), 0 2px 8px rgba(0,0,0,0.5)',
      ],
    }}
    transition={{
      scale: { duration: 0.45, times: [0, 0.6, 1] },
      boxShadow: { duration: 1.4, repeat: Infinity },
    }}
  >
    ✨ Your Turn!
  </motion.div>
) : (
  <div
    className="px-4 py-1.5 rounded-full text-slate-300 text-sm"
    style={{
      background: 'rgba(15,20,15,0.85)',
      border: '1px solid rgba(100,120,100,0.3)',
      boxShadow: '0 1px 6px rgba(0,0,0,0.5)',
    }}
  >
    🎯 <span className="text-slate-100 font-semibold">{currentPlayer.name}</span>&apos;s Turn
  </div>
)}
```

- [ ] **Step 5d.2 — TypeScript check**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 5d.3 — Commit all Task 5 changes**

```bash
git add components/game/GameTable.tsx components/game/PlayerSeat.tsx components/game/TrickPile.tsx components/game/TurnIndicator.tsx
git commit -m "feat: premium casino table enhancements — legs, amber glow, chip stacks, gold zones, enhanced seats

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 6 — Mobile Responsive Layout

This task adds a dedicated mobile layout with an opponent strip, responsive table sizing, mobile card sizes, and a horizontal bid strip.

**Files:**
- Create: `components/game/OpponentStrip.tsx`
- Modify: `components/game/GameTable.tsx`
- Modify: `components/cards/CardHand.tsx`

---

### 6a — Create OpponentStrip Component

This component renders a compact horizontal row of opponents shown only on mobile portrait.

- [ ] **Step 6a.1 — Create `components/game/OpponentStrip.tsx`**

```tsx
'use client';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import type { Player, Card as CardType, Suit } from '@/types';

const SUIT_SYMBOLS: Record<string, string> = {
  spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣',
};

const AVATAR_GRADIENTS = [
  'from-purple-600 to-indigo-700',
  'from-blue-600 to-cyan-600',
  'from-emerald-600 to-teal-600',
  'from-orange-600 to-red-600',
  'from-pink-600 to-rose-600',
  'from-amber-500 to-orange-600',
  'from-sky-500 to-blue-600',
  'from-violet-600 to-purple-700',
];

function nameHash(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return h;
}

interface OpponentStripProps {
  opponents: Player[];
  currentTurnPlayerId: string | null;
  trickCards: { playerId: string; card: CardType }[];
  handCounts: Record<string, number>;
  revealedPartnerIds: string[];
}

export default function OpponentStrip({
  opponents,
  currentTurnPlayerId,
  trickCards,
  handCounts,
  revealedPartnerIds,
}: OpponentStripProps) {
  if (opponents.length === 0) return null;

  return (
    <div
      className="shrink-0 flex items-center justify-center gap-2 px-2 py-1.5 overflow-x-auto"
      style={{
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.7) 100%)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
      }}
    >
      {opponents.map((player) => {
        const isCurrentTurn = player.id === currentTurnPlayerId;
        const isPartner = revealedPartnerIds.includes(player.id);
        const trickCard = trickCards.find((tc) => tc.playerId === player.id)?.card ?? null;
        const cardCount = handCounts[player.id] ?? 0;
        const isRed = trickCard && (trickCard.suit === 'hearts' || trickCard.suit === 'diamonds');
        const gradient = AVATAR_GRADIENTS[nameHash(player.name) % AVATAR_GRADIENTS.length];

        return (
          <motion.div
            key={player.id}
            className="flex flex-col items-center gap-0.5 shrink-0"
            animate={isCurrentTurn ? { scale: [1, 1.06, 1] } : { scale: 1 }}
            transition={isCurrentTurn ? { duration: 1.2, repeat: Infinity } : {}}
          >
            {/* Trick card played — mini face-up */}
            <AnimatePresence>
              {trickCard ? (
                <motion.div
                  key={trickCard.suit + trickCard.rank}
                  initial={{ scale: 0.5, opacity: 0, y: -8 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.5, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 24 }}
                  style={{
                    width: 28, height: 40,
                    background: '#fff',
                    borderRadius: 4,
                    border: '1px solid #ccc',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.5)',
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    gap: 1,
                    padding: '2px',
                  }}
                >
                  <span style={{
                    fontSize: 9, fontWeight: 800, lineHeight: 1,
                    color: isRed ? '#c0152a' : '#1a1a2e',
                  }}>
                    {trickCard.rank}
                  </span>
                  <span style={{
                    fontSize: 12, lineHeight: 1,
                    color: isRed ? '#c0152a' : '#1a1a2e',
                  }}>
                    {SUIT_SYMBOLS[trickCard.suit]}
                  </span>
                </motion.div>
              ) : (
                /* Card count badge when no trick card yet */
                <div style={{
                  width: 28, height: 40,
                  background: 'linear-gradient(135deg, #1e3a8a, #2563eb)',
                  borderRadius: 4,
                  border: '1px solid rgba(96,165,250,0.4)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.8)' }}>
                    {cardCount}
                  </span>
                </div>
              )}
            </AnimatePresence>

            {/* Avatar */}
            <div
              className={clsx('rounded-full bg-gradient-to-br flex items-center justify-center font-bold text-xs text-white', gradient)}
              style={{
                width: 28, height: 28,
                boxShadow: isCurrentTurn
                  ? '0 0 0 2px rgba(34,197,94,0.8), 0 0 10px rgba(34,197,94,0.5)'
                  : isPartner
                  ? '0 0 0 2px rgba(52,211,153,0.6)'
                  : '0 0 0 1px rgba(255,255,255,0.1)',
              }}
            >
              {player.avatarUrl ? (
                <img src={player.avatarUrl} alt={player.name} className="w-full h-full object-cover rounded-full" />
              ) : (
                <span style={{ fontSize: 10 }}>{player.name.charAt(0)}</span>
              )}
            </div>

            {/* Name */}
            <span
              className="truncate text-center"
              style={{
                fontSize: 8, maxWidth: 36,
                color: isCurrentTurn ? '#86efac' : 'rgba(200,200,200,0.7)',
                fontWeight: isCurrentTurn ? 700 : 400,
              }}
            >
              {player.name}
            </span>
          </motion.div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 6a.2 — TypeScript check**

```bash
npx tsc --noEmit
```

Expected: zero errors.

### 6b — Add Responsive Breakpoints and OpponentStrip to GameTable

- [ ] **Step 6b.1 — Add `isTablet` state in GameTable.tsx**

In `components/game/GameTable.tsx`, find the `isMobile` useEffect (line ~418):

```tsx
// FIND:
useEffect(() => {
  const check = () => setIsMobile(window.innerWidth < 640);
  check();
  window.addEventListener('resize', check);
  return () => window.removeEventListener('resize', check);
}, []);

// REPLACE WITH:
const [isTablet, setIsTablet] = useState(false);

useEffect(() => {
  const check = () => {
    const w = window.innerWidth;
    setIsMobile(w < 640);
    setIsTablet(w >= 640 && w < 1024);
  };
  check();
  window.addEventListener('resize', check);
  return () => window.removeEventListener('resize', check);
}, []);
```

Also add `const [isTablet, setIsTablet] = useState(false);` with the other useState declarations at the top of `GameTable`.

- [ ] **Step 6b.2 — Add OpponentStrip import and render on mobile**

At the top of `components/game/GameTable.tsx`, add the import:

```tsx
import OpponentStrip from '@/components/game/OpponentStrip';
```

Then in the JSX, after the top bar `</motion.div>` and BEFORE the `{/* ── Table area */}` div, add:

```tsx
{/* ── Opponent strip — mobile portrait only ── */}
{isMobile && (
  <OpponentStrip
    opponents={players.filter((p) => p.id !== myPlayerId)}
    currentTurnPlayerId={currentTurnPlayerId}
    trickCards={currentTrick?.cards ?? []}
    handCounts={hands}
    revealedPartnerIds={revealedPartnerIds}
  />
)}
```

- [ ] **Step 6b.3 — Responsive table dimensions**

In `components/game/GameTable.tsx`, find the casino table `<motion.div ref={tableRef}>` style (line ~656):

```tsx
// FIND:
style={{
  width: 'min(94vw, 920px)',
  height: 'min(52vh, 480px)',
  minHeight: '260px',
  perspective: '900px',
  transformStyle: 'preserve-3d',
}}

// REPLACE WITH:
style={{
  width: isMobile ? '96vw' : isTablet ? 'min(94vw, 760px)' : 'min(94vw, 920px)',
  height: isMobile ? 'auto' : isTablet ? 'min(50vh, 380px)' : 'min(52vh, 480px)',
  aspectRatio: isMobile ? '2/1' : undefined,
  minHeight: isMobile ? '200px' : '260px',
  perspective: isMobile ? '600px' : '900px',
  transformStyle: 'preserve-3d',
}}
```

Also update the `rotateX` in the `animate` prop of the same `motion.div`:

```tsx
// FIND:
animate={{ scale: 1, opacity: 1, rotateX: 18 }}

// REPLACE WITH:
animate={{ scale: 1, opacity: 1, rotateX: isMobile ? 10 : 18 }}
```

- [ ] **Step 6b.4 — Pass mobile card size prop to CardHand**

In `components/game/GameTable.tsx`, find the `<CardHand` usage (line ~935) and add the `compact` prop:

```tsx
// FIND:
<CardHand
  cards={myHand}
  playableCardIds={playableCardIds}
  selectedCardId={selectedCardId}
  onCardSelect={(card) => setSelectedCardId(card.id)}
  onCardPlay={(card) => {
    setSelectedCardId(null);
    onPlayCard(card);
  }}
  isMyTurn={isMyTurn && phase === 'playing'}
  leadSuit={currentTrick?.leadSuit}
  trumpSuit={trumpSuit}
  expandedView={phase === 'bidding'}
/>

// REPLACE WITH:
<CardHand
  cards={myHand}
  playableCardIds={playableCardIds}
  selectedCardId={selectedCardId}
  onCardSelect={(card) => setSelectedCardId(card.id)}
  onCardPlay={(card) => {
    setSelectedCardId(null);
    onPlayCard(card);
  }}
  isMyTurn={isMyTurn && phase === 'playing'}
  leadSuit={currentTrick?.leadSuit}
  trumpSuit={trumpSuit}
  expandedView={phase === 'bidding'}
  compact={isMobile}
/>
```

- [ ] **Step 6b.5 — TypeScript check**

```bash
npx tsc --noEmit
```

Expected: zero errors (if you get "Property 'compact' does not exist on type 'CardHandProps'" that's expected — fix it in the next step).

### 6c — Add `compact` Prop to CardHand

- [ ] **Step 6c.1 — Add `compact` prop to CardHand interface and use it for card sizing**

In `components/cards/CardHand.tsx`, update the interface and constants:

```tsx
// FIND:
const CARD_W = 64;
const CARD_H = 96;

// REPLACE WITH:
const CARD_W_DESKTOP = 64;
const CARD_H_DESKTOP = 96;
const CARD_W_MOBILE = 48;
const CARD_H_MOBILE = 72;
```

```tsx
// FIND the interface:
interface CardHandProps {
  cards: CardType[];
  playableCardIds?: Set<string>;
  selectedCardId?: string | null;
  onCardSelect?: (card: CardType) => void;
  onCardPlay?: (card: CardType) => void;
  isMyTurn?: boolean;
  leadSuit?: Suit | null;
  trumpSuit?: Suit | null;
  expandedView?: boolean;
}

// REPLACE WITH:
interface CardHandProps {
  cards: CardType[];
  playableCardIds?: Set<string>;
  selectedCardId?: string | null;
  onCardSelect?: (card: CardType) => void;
  onCardPlay?: (card: CardType) => void;
  isMyTurn?: boolean;
  leadSuit?: Suit | null;
  trumpSuit?: Suit | null;
  expandedView?: boolean;
  compact?: boolean;
}
```

In the function body, add `compact = false` to destructuring and use the responsive sizes:

```tsx
// FIND:
export default function CardHand({
  cards,
  playableCardIds,
  selectedCardId,
  onCardSelect,
  onCardPlay,
  isMyTurn = false,
  leadSuit,
  trumpSuit,
  expandedView = false,
}: CardHandProps) {

// REPLACE WITH:
export default function CardHand({
  cards,
  playableCardIds,
  selectedCardId,
  onCardSelect,
  onCardPlay,
  isMyTurn = false,
  leadSuit,
  trumpSuit,
  expandedView = false,
  compact = false,
}: CardHandProps) {
  const CARD_W = compact ? CARD_W_MOBILE : CARD_W_DESKTOP;
  const CARD_H = compact ? CARD_H_MOBILE : CARD_H_DESKTOP;
```

- [ ] **Step 6c.2 — TypeScript check**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 6c.3 — Commit all Task 6 changes**

```bash
git add components/game/OpponentStrip.tsx components/game/GameTable.tsx components/cards/CardHand.tsx
git commit -m "feat: mobile responsive layout with OpponentStrip, responsive table sizing, compact CardHand

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 7 — Final Build + Verification

- [ ] **Step 7.1 — Full TypeScript check**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 7.2 — Production build**

```bash
npm run build
```

Expected: Build succeeds with no errors. Warnings about bundle size are acceptable.

- [ ] **Step 7.3 — Manual verification checklist**

Start dev server: `npm run dev`

Test in browser at `http://localhost:3000`:
- [ ] Share link in lobby shows `http://localhost:3000/room/<id>` (not `192.168.3.112`)
- [ ] Deal animation ends ≤ 1s after last card arrives in hand
- [ ] Cards are visible during bidding phase (not covered by BidPanel)
- [ ] Hide button (🙈) works in bidding phase
- [ ] Hide button (🙈) works in playing phase (before your turn)
- [ ] Cards auto-reveal when it becomes your turn to play
- [ ] Table shows: thick gold rail, mahogany wood, kelly green felt
- [ ] Table shows: chip stacks at 4 corners, gold zone line
- [ ] Table legs + amber glow visible below the table (desktop only)
- [ ] All player seats render with premium name plaques
- [ ] Active player has green glow ring
- [ ] Trick pile cards have winner glow + lift
- [ ] Mobile (< 640px): OpponentStrip renders at top with opponent avatars + cards
- [ ] Mobile: Table scales to `96vw` with reduced `rotateX(10deg)`
- [ ] Mobile: Cards scale to 48×72px
- [ ] Chat side panel still works on desktop
- [ ] Chat bottom drawer still works on mobile

- [ ] **Step 7.4 — Final commit**

```bash
git add -A
git commit -m "chore: all UI overhaul tasks complete — bugs fixed, premium table, mobile responsive

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## File Map

| File | Tasks |
|---|---|
| `app/room/[roomId]/page.tsx` | Task 1 (share link) |
| `components/game/GameTable.tsx` | Tasks 2, 3, 4, 5a, 5b (refs), 6b, 6c (refs) |
| `components/game/PlayerSeat.tsx` | Task 5b |
| `components/game/TrickPile.tsx` | Task 5c |
| `components/game/TurnIndicator.tsx` | Task 5d |
| `components/cards/CardHand.tsx` | Task 6c |
| `components/game/OpponentStrip.tsx` | Task 6a (new file) |

## What NOT to Change

- `lib/game-engine/` — pure game logic
- `lib/socket/socketClient.ts` — socket events
- `store/` — Zustand stores
- `hooks/` — custom hooks
- `server.ts` — Socket.IO server
- `types/` — TypeScript types

---

## Notes for Executor

1. Run `npx tsc --noEmit` after every task. A TypeScript error means stop and fix before continuing.
2. Tasks 1–4 are bug fixes — do them first. They are independent of each other.
3. Tasks 5–6 can be partially parallelized: Task 5 (visual enhancements) and Task 6 (new `OpponentStrip.tsx`) are independent. GameTable.tsx changes in 5 and 6 must be sequential (same file).
4. The `CARD_W`/`CARD_H` constants in `CardHand.tsx` are used inline — when you add `const CARD_W = compact ? ... : ...` inside the function body, TypeScript will shadow the module-level constants. The existing `const CARD_W = 64` line at the module level should be **removed** and replaced with the `CARD_W_DESKTOP`/`CARD_W_MOBILE` pairs at module level.
5. The `isTablet` state declaration must be added to the `useState` block at the TOP of `GameTable` (line ~403), alongside the other state declarations.
