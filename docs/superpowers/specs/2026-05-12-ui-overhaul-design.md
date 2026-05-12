# 3 of Spades — UI Overhaul & Bug Fix Design Spec

**Date:** 2026-05-12  
**Status:** Approved  
**Scope:** 6 tasks covering bug fixes, premium UI redesign, and full mobile responsiveness

---

## Overview

The deployed app at `https://3ofspades-production.up.railway.app/` has 4 bugs and requires a complete UI redesign to match the reference casino table image and be fully responsive across all devices.

---

## Task 1 — Fix Deal Animation Lingering Bug

### Problem
The deal animation keeps showing after all cards are distributed. Root cause: the `ROUNDS` clamping logic in `DealAnimation` (`Math.min(cardsPerPlayer, ...)`) returns a value less than `cardsPerPlayer`, so `onCardDealtToMe` fires fewer times than expected, and the `dealRevealedCount >= myHand.length` condition in the `useEffect` never triggers `setDealAnimDone(true)`.

### Fix
**File:** `components/game/GameTable.tsx`

1. Remove the `Math.min(...)` cap on `ROUNDS` — always deal all `cardsPerPlayer` rounds:
   ```ts
   const ROUNDS = cardsPerPlayer; // was: Math.min(cardsPerPlayer, Math.floor(13 / (N * DEAL_INTERVAL)))
   ```
2. The existing `useEffect` that calls `setDealAnimDone(true)` after 1s when `dealRevealedCount >= myHand.length` is correct — keep it.
3. Add a hard fallback timeout: `totalDuration * 1000 + 2000` ms so the animation always ends even if socket events are slow.

### Acceptance Criteria
- Animation starts when phase transitions to `'dealing'`
- Animation ends ≤ 1s after the last card arrives in hand
- Animation does NOT linger after all 8 cards are dealt

---

## Task 2 — Fix Cards Invisible During Bidding

### Problem
`BidPanel` is rendered as `fixed inset-0 z-50 flex items-center justify-center` — this creates a full-screen backdrop that overlays the `CardHand` div rendered below it in the DOM.

### Fix
**File:** `components/game/GameTable.tsx`

Remove the `fixed inset-0` wrapper. Instead position the bid panel inside the table area using `absolute` positioning (centered, z-index above table but below the card hand strip):

```tsx
{/* Bid panel — centered above table, cards still visible below */}
{showBidPanel && (
  <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 z-20 flex justify-center pointer-events-none px-4">
    <div className="pointer-events-auto w-full max-w-sm">
      <BidPanel ... />
    </div>
  </div>
)}
```

The bid panel sits inside the `table-area` div (which is `flex-1 relative`), centered over the felt. The card hand strip below is a sibling element — unaffected by the overlay.

Also add a hint above the card hand during bidding:
```tsx
{phase === 'bidding' && (
  <div className="text-center py-1">
    <span className="text-[11px] text-amber-400/80">🃏 Your cards — bid wisely</span>
  </div>
)}
```

### Acceptance Criteria
- During bidding, the player's cards are fully visible at the bottom
- Cards are the same size as during playing phase
- BidPanel is visible and fully interactive

---

## Task 3 — Fix Hand Hide/Show Functionality

### Problem
The hidden overlay condition is `handHidden && !(isMyTurn && phase === 'playing')` — this means pressing Hide during the bidding phase has no effect (because `phase !== 'playing'` makes the condition false when `isMyTurn` is false, but during bidding `phase === 'bidding'` so the whole condition evaluates differently). Additionally, the overlay is visually broken in some states.

### Fix
**File:** `components/game/GameTable.tsx`

Simplify the condition: hide whenever `handHidden` is true, always force-show on your play turn:

```tsx
// Auto-reveal on play turn (existing) — keep this
useEffect(() => {
  if (isMyTurn && phase === 'playing') setHandHidden(false);
}, [isMyTurn, phase]);

// Hide overlay — show whenever handHidden regardless of phase
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

Remove the `!(isMyTurn && phase === 'playing')` guard entirely — the `useEffect` auto-reveal handles the force-show case.

### Acceptance Criteria
- Pressing 🙈 hides cards in all phases (bidding, playing, trump selection, partner selection)
- Pressing 👁️ reveals cards
- Cards auto-reveal when it becomes your turn to play

---

## Task 4 — Fix Share Link for Railway Deployment

### Problem
The share link is hardcoded as `http://192.168.3.112:<port>/room/<id>` — a LAN IP that doesn't work on Railway or any deployment outside that local network.

### Fix
**File:** `app/room/[roomId]/page.tsx`

Replace lines 76-78:
```ts
// REMOVE:
const LAN_IP = '192.168.3.112';
const port = typeof window !== 'undefined' ? window.location.port : '3000';
const shareLink = `http://${LAN_IP}:${port || '3000'}/room/${roomId}`;

// REPLACE WITH:
const shareLink = typeof window !== 'undefined'
  ? `${window.location.origin}/room/${roomId}`
  : `/room/${roomId}`;
```

Also update the label on line 277:
```tsx
// REMOVE:  🔗 Share Link (LAN)
// REPLACE: 🔗 Share Link
```

Remove the now-unnecessary `copyToClipboard` fallback comment about LAN HTTP (keep the function, just update the comment).

### Acceptance Criteria
- On Railway: share link shows `https://3ofspades-production.up.railway.app/room/<id>`
- On LAN dev: share link shows `http://192.168.x.x:3000/room/<id>` (derived from `window.location.origin`)
- Copy button works on both HTTP and HTTPS

---

## Task 5 — Premium Casino Table Redesign

### Design Language

| Token | Value |
|---|---|
| Primary accent | Gold `#d4a017`, `#fbbf24` |
| Felt green | `#2db84d` → `#0a3a1a` radial |
| Wood mahogany | `#8B4513` → `#0a0300` |
| Gold rail | `rgba(180,130,10,0.98)` multi-layer |
| Background | `radial-gradient(ellipse 160% 120% at 50% 60%, #071507, #020802, #000)` |
| Text primary | `#e2e8f0` |
| Team A score | `#7dd3fc` (sky) |
| Team B score | `#fb923c` (orange) |
| My turn | `#4ade80` (green) with glow |
| Danger/pass | `#ef4444` / `#7f1d1d` |

### 5a — GameTable.tsx — Premium Table

The casino table uses 8 layered `div`s (bottom → top):

1. **Physical depth** — dark mahogany shifted `translateY(18px) scaleX(0.96)`, massive drop shadow (gives table physical height like reference image)
2. **Outer mahogany rail** — warm `#8B4513` → `#0a0300` radial gradient
3. **Outer gold bevel** — thin `2px` gold line at outer edge
4. **THICK GOLD/BRASS RAIL** — the hero element. Multi-layer `box-shadow` creating 20px-wide metallic rail:
   - `0 0 0 18px rgba(180,130,10,0.98)` — base gold
   - `0 0 0 14px rgba(255,220,40,0.6)` — bright highlight
   - `0 0 0 20px rgba(120,85,5,0.8)` — outer shadow edge
   - `0 0 50px rgba(212,160,23,0.55)` — ambient glow
5. **Inner dark wood channel** — `#5a2a0a` → `#0a0400` between rail and felt
6. **Felt edge trim** — thin `2px` gold bead at felt boundary
7. **Kelly green felt** — `#3dc95a` → `#0a3a1a` radial, with weave texture overlay (`opacity: 0.04`)
8. **Overhead lamp** — `radial-gradient` warm white at top-center of felt

**Additional table elements:**
- **Name plates in rail**: Rectangular gold plaques (`linear-gradient #8B6914→#FFD700→#8B6914`) positioned at top/bottom of rail for each player name
- **Table legs**: 4 dark mahogany rectangular legs visible below (via `rotateX(18deg)` perspective tilt)
- **Amber underside glow**: `radial-gradient` warm amber below legs (matches reference image)
- **Chip stacks**: Coloured SVG/div circles stacked at table corners (decorative)
- **Gold zone lines**: Subtle `rgba(212,160,23,0.25)` border rect on felt (player zone markers)

**Table dimensions:**
- Desktop: `width: min(94vw, 920px)`, `height: min(52vh, 480px)`, `rotateX(18deg)`
- Tablet landscape: `width: min(94vw, 760px)`, `height: min(50vh, 380px)`
- Mobile portrait: `width: 92vw`, `height: auto`, `aspect-ratio: 2/1`, `rotateX(12deg)`

### 5b — PlayerSeat.tsx

- Avatar size: `w-11 h-11` (44px), colored gradients per player index
- Dark drop shadow ring behind avatar: `box-shadow: 0 0 0 3px rgba(0,0,0,0.6)`
- Active turn: pulsing green ring (`0 0 0 5px rgba(34,197,94,0.6)`) + scale animation
- Partner revealed: emerald ring
- Bot badge: `🤖` small overlay bottom-right
- Card count badge: dark pill top-right of avatar
- Name + pts always visible, team color for pts

### 5c — BidPanel.tsx

Keep existing design (it's already premium). Only change is positioning (Task 2).

### 5d — TrickPile.tsx

- Card size: `w-11 h-16` (44×64px)
- Winner card: gold border + glow + `translateY(-6px)` + `👑` above
- 3♠ card: amber/gold shimmer
- Trump card: subtle orange border
- 8-dot progress bar below cards (filled green / empty gray)

### 5e — CardHand.tsx

- Card size: `CARD_W=64 CARD_H=96` (unchanged on desktop)
- Mobile portrait: scale to `CARD_W=48 CARD_H=72`
- Lead suit cards: green pulsing glow border
- Selected card: sky-blue border, lifted `translateY(-16px)`
- Partner cards bar: pill badges above hand during playing phase

### 5f — Full Page Layout (GameTable.tsx top level)

```
┌─────────────────────────────────────────────────────┐
│  Top Bar: [End] [Turn] [Trump] [Round] ... [Score][Chat][Hide] │
├─────────────────────────────────────────────────────┤
│                                                     │
│    ████████████ Casino Table ████████████          │
│    ██ Gold rail, felt, players, tricks ██          │
│                                                     │
│         [BidPanel centered in table area]          │
│                                                     │
├─────────────────────────────────────────────────────┤
│  Partner bar (if playing phase)                    │
│  Card Hand — always visible, same size             │
└─────────────────────────────────────────────────────┘
     [Chat side panel 280px — desktop only]
```

### 5g — Other Components

- **TrumpSelector**: Full-screen backdrop, 2×2 suit grid, hand strip preview
- **PartnerSelector**: Full-screen backdrop, card grid by suit
- **RoundResult**: Modal — bid made/failed badge, score table, host start button
- **WinnerScreen**: Confetti, trophy animation, team scores, round history
- **TurnIndicator**: `✨ Your Turn!` — green glowing pill with box-shadow pulse
- **Scoreboard**: Slide-in right panel, trump/bid info, team sections with stats

---

## Task 6 — Mobile Responsive Layout

### Breakpoints

| Range | Layout name |
|---|---|
| `< 640px` | Mobile portrait |
| `640px – 1023px` | Tablet / mobile landscape |
| `≥ 1024px` | Desktop |

### Mobile Portrait (`< 640px`)

```
┌──────────────────────────┐
│  Top bar (compact icons) │
├──────────────────────────┤
│  Opponent strip:         │
│  [P1] [P2] [P3] [P4] [P5]│
│  avatar + played card    │
│  or card-count badge     │
├──────────────────────────┤
│                          │
│   3D oval table          │
│   (scaled: 92vw wide)    │
│   rotateX(12deg)         │
│   Trump + trick center   │
│                          │
├──────────────────────────┤
│  Bid strip (if bidding): │
│  [150] [160][170][MAX][Pass]│
├──────────────────────────┤
│  Card hand (larger cards)│
│  48×72px cards           │
└──────────────────────────┘
```

**Opponent strip:** Each opponent shown as:
- Small avatar (28px) with colored gradient
- Name (8px, truncated)
- Played card (if they played this trick) — mini face-up card
- OR card count badge if not played yet
- Active player: pulsing green ring

**Key rule:** BidPanel NEVER covers the card hand on mobile. Bid controls appear as a compact horizontal strip between the table and the hand.

**Chat:** Full-screen bottom drawer (55vh), triggered by 💬 button.

### Tablet / Landscape (`640px – 1023px`)

- Full 3D oval table fits in screen width
- All 6 player seats around the oval
- Card hand at bottom, `48px` card width
- BidPanel: centered modal in table area (same as desktop, smaller)
- Chat: bottom drawer

### Desktop (`≥ 1024px`)

- Full 3D oval table, `920px` max-width
- All 6 player seats with full name/pts display
- Card hand at bottom, `64px` card width
- BidPanel: centered modal in table area
- Chat: 280px side panel with CSS width transition
- Scoreboard: slide-in right panel

### CSS Strategy

Use a single `isMobile` boolean (already exists: `window.innerWidth < 640`) and add `isTablet` (`640 ≤ width < 1024`). Pass to `GameTable` and children.

For the opponent strip (mobile only):
```tsx
{isMobile && (
  <OpponentStrip players={opponents} currentTrickCards={currentTrick?.cards} currentTurnPlayerId={...} />
)}
```

For the table itself, apply responsive sizing via inline `style` based on breakpoint.

All `perspective`, `rotateX`, `rail thickness` values scale proportionally.

---

## Implementation Order

Work in this order to avoid breakage:

1. **Task 4** — Share link (1 line change, zero risk)
2. **Task 1** — Deal animation fix (isolated component)
3. **Task 3** — Hide/show fix (condition change)
4. **Task 2** — BidPanel positioning (layout change)
5. **Task 5** — Full table + component redesign (GameTable → PlayerSeat → TrickPile → CardHand → overlays → pages)
6. **Task 6** — Mobile responsive (add OpponentStrip component, breakpoint logic, responsive sizing)

Run `npx tsc --noEmit` after each task. Do NOT change any socket events, game engine, or Zustand store logic.

---

## Files to Change

| File | Tasks |
|---|---|
| `app/room/[roomId]/page.tsx` | Task 4 |
| `components/game/GameTable.tsx` | Tasks 1, 2, 3, 5, 6 |
| `components/game/PlayerSeat.tsx` | Tasks 5, 6 |
| `components/game/TrickPile.tsx` | Task 5 |
| `components/game/BidPanel.tsx` | Task 2 (positioning only) |
| `components/cards/CardHand.tsx` | Tasks 5, 6 |
| `components/game/TrumpSelector.tsx` | Task 5 |
| `components/game/PartnerSelector.tsx` | Task 5 |
| `components/game/RoundResult.tsx` | Task 5 |
| `components/game/WinnerScreen.tsx` | Task 5 |
| `components/game/TurnIndicator.tsx` | Task 5 |
| `components/game/Scoreboard.tsx` | Task 5 |
| `components/game/OpponentStrip.tsx` | Task 6 (new file) |
| `app/globals.css` | Task 5 (font imports if needed) |

---

## What NOT to Change

- `lib/game-engine/` — pure game logic, untouched
- `lib/socket/socketClient.ts` — socket events, untouched
- `store/` — Zustand stores, untouched
- `hooks/` — untouched
- `server.ts` — untouched
- `types/` — untouched
- All TypeScript interfaces

---

## Verification

After all tasks:
```bash
npx tsc --noEmit       # zero errors
npm run build          # successful build
```

Manual test checklist:
- [ ] Deal animation ends after last card is dealt
- [ ] Cards visible during bidding phase
- [ ] Hide button works in all phases
- [ ] Share link shows correct Railway/origin URL
- [ ] Table shows thick gold rail, mahogany wood, kelly green felt
- [ ] Table legs and amber glow visible (desktop)
- [ ] All 6 player seats render correctly around the oval
- [ ] Mobile portrait: opponent strip visible, hand visible, bid strip visible
- [ ] Mobile landscape: full oval table visible
- [ ] Desktop: chat side panel works
- [ ] No game logic regressions
