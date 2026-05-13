# 3 of Spades — UI Bug Fixes & Polish Design Spec
**Date:** 2026-05-13  
**Status:** Approved  
**Source:** `fixes.md` + brainstorming session

---

## Problem Statement

The live game at `https://3ofspades-production.up.railway.app/` has five categories of UI bugs:

1. Deal animation ends before all cards are dealt (time-cap bug)
2. Cards appear dim (60% opacity) during bidding phase — should be fully bright
3. Game table center HUD is cluttered — trump badge, trick counter, progress dots, and emblem stack on each other
4. Hide cards (🙈) overlay doesn't render correctly over the card hand
5. Mobile landscape orientation breaks layout — table too tall, cards cut off

---

## Constraints

- **DO NOT** modify: `lib/game-engine/`, `lib/socket/socketClient.ts`, `lib/socket/socketServer.ts`, `store/`, `hooks/`, `types/`, `config/gameConfig.ts`
- Run `npx tsc --noEmit` after every task — zero errors required
- GSAP for deal animation and trick pile card entrance; Framer Motion stays for all other animations

---

## Task 1 — Fix Deal Animation (Card-Count-Based)

### Problem
`DealAnimation` uses `Math.min(cardsPerPlayer, Math.floor(13 / (N * DEAL_INTERVAL)))` which caps `ROUNDS` and stops the animation before all cards are dealt. The `dealRevealedCount >= myHand.length` trigger never fires.

### Solution
**Files:** `components/game/GameTable.tsx`

- Replace `ROUNDS = Math.min(...)` with `ROUNDS = cardsPerPlayer` — always deal ALL cards
- Remove all `clampedRounds` references; replace with `ROUNDS`
- `totalDuration` timeout uses `totalDuration * 1000 + 800` ms (800ms buffer)
- Auto-end fallback `useEffect`: fires `setDealAnimDone(true)` when `dealRevealedCount >= myHand.length` after +1200ms
- Reset effect: `setDealAnimDone(false)`, `setDealRevealedCount(0)`, `setHandHidden(false)` when `gameState.phase === 'dealing'`

### GSAP Integration
Replace the card flight sequence in `DealAnimation` with a `gsap.timeline()` that staggers card animations by index. Each card animates from the deck center to its target position using `gsap.fromTo()` with `stagger: DEAL_INTERVAL`. The timeline `onComplete` fires `onCardDealtToMe` for each card dealt to the player. Framer Motion wrappers around the `DealAnimation` component stay as-is.

---

## Task 2 — Cards Full Brightness During Bidding

### Problem
`Card.tsx` applies `opacity-60` when `playable === false`. During bidding, `playableCardIds` is never populated so all cards get `playable={false}` and appear dim.

### Solution
**Files:** `components/cards/Card.tsx`, `components/cards/CardHand.tsx`, `components/game/GameTable.tsx`

- Add `dimIfNotPlayable?: boolean` prop to `Card` (defaults `true`)
- Apply `opacity-60` only when `!playable && !selected && dimIfNotPlayable`
- Add `dimIfNotPlayable?: boolean` prop to `CardHand`; pass it through to each `Card`
- In `GameTable.tsx`, pass `dimIfNotPlayable={phase !== 'bidding'}` to `CardHand`
- Ensure `expandedView` hint text has `opacity: 1` during bidding

---

## Task 3 — Declutter Table Center HUD

### Problem
Trump badge + trick counter text + progress dots + gold emblem all visible simultaneously — overlapping, hard to read, especially on mobile.

### Solution
**Files:** `components/game/TrickPile.tsx`, `components/game/GameTable.tsx`, `components/game/PlayerSeat.tsx`

#### TrickPile.tsx
- Empty state: show only a compact trick-count badge (`Trick N / T`) — no circle, no dots
- Cards in trick: `flex items-end gap-2 flex-wrap justify-center` — cards spread in a clean row, never overlapping
- Card dimensions: `width: 44, height: 62`
- GSAP card entrance: each card animates in with `gsap.fromTo(el, { scale: 0.6, opacity: 0, y: -12 }, { scale: 1, opacity: 1, y: 0, duration: 0.25, ease: 'back.out(1.4)' })`

#### GameTable.tsx — Center HUD
- Restructure center div to clean vertical stack: `flex-col items-center justify-center gap-3`
- Trump badge: `AnimatePresence` + `motion.div` — only rendered when `trumpSuit` is set
- Remove separate "Trick X/Y" text label — badge in TrickPile handles it
- Remove progress dots bar below trick pile
- Gold emblem: visible only when `(!currentTrick || currentTrick.cards.length === 0) && phase !== 'playing'`

#### PlayerSeat.tsx
- Player name: `text-[11px]`, max-w `72px`
- Score text: `text-[10px]`
- Add `extraCompact?: boolean` prop — when true, avatar is 32px (used in landscape)

---

## Task 4 — Fix Hide Cards Feature

### Problem
The hide overlay condition `handHidden && !(isMyTurn && phase === 'playing')` causes the overlay to disappear incorrectly. Z-index may be wrong.

### Solution
**Files:** `components/game/GameTable.tsx`

- Overlay: `absolute inset-0 z-10` inside the `relative` wrapper around `CardHand`
- Render condition: simply `{handHidden && <div ...>}` — no phase guard on the overlay itself
- Overlay content: blue card back placeholders (`myHand.map((_, i) => <div key={i} style={cardBackStyle} />)`) + "Cards hidden — tap 👁️ to reveal" label
- Auto-reveal `useEffect`: `if (isMyTurn && phase === 'playing') setHandHidden(false)` — only triggers on play turn
- Toggle button: `() => setHandHidden(v => !v)` — no phase guard
- Reset: add `setHandHidden(false)` inside the `phase === 'dealing'` reset effect

---

## Task 5 — Mobile Landscape Responsiveness

### Problem
`isMobile` only checks width (`< 640px`), missing landscape phones (e.g. 812×375). Table overflows, cards cut off.

### Solution
**Files:** `components/game/GameTable.tsx`, `components/cards/CardHand.tsx`, `components/game/PlayerSeat.tsx`

#### Orientation Detection
```tsx
const [isLandscape, setIsLandscape] = useState(false);

// In resize/orientationchange handler:
const isLandscapePhone = w >= 480 && h < 500 && w > h;
const isPortraitPhone = w < 640;
setIsMobile(isPortraitPhone || isLandscapePhone);
setIsLandscape(w > h);
```
Listen to both `resize` and `orientationchange`.

#### Layout Switch
When `isMobile && isLandscape`:
- Outer wrapper: `flexDirection: 'row'`
- Game section: `flex: 1`, contains top bar + opponent strip + table
- Card hand column: `width: 32vw`, `background: linear-gradient(to left, rgba(0,0,0,0.95), rgba(0,0,0,0.7))`, `borderLeft: 1px solid rgba(255,255,255,0.05)`
- Bottom card hand (portrait): hidden when `isMobile && isLandscape`
- Table dimensions in landscape: `width: 70vw`, `height: min(85vh, 340px)`
- Top bar padding: `2px 8px` in landscape
- Pass `extraCompact={isMobile && isLandscape}` to all `PlayerSeat` components

#### CardHand — Vertical Mode
Add `vertical?: boolean` prop. When true:
- `flex-col items-center gap-1 overflow-y-auto h-full px-1 py-2`
- Each `Card` uses `small={true}` and `dimIfNotPlayable={false}`
- No fan/hover transforms — straight column layout

#### BidPanel in Landscape
BidPanel wrapper uses `absolute inset-x-0 top-1/2 -translate-y-1/2 z-20`, max-width `max-w-sm`, with `overflow-y-auto max-h-[80%]`.

---

## Task 6 — Additional Polish

**Files:** `components/game/GameTable.tsx`, `components/game/TrickPile.tsx`

- BidPanel wrapper: confirm `absolute` (not `fixed`) positioning
- Trick card constants: `TRICK_CARD_W = 48`, `TRICK_CARD_H = 68`  
- Partner cards bar: `flex items-center justify-center gap-1.5 mb-1.5 px-3 flex-wrap`

---

## Files Modified

| File | Tasks |
|------|-------|
| `components/game/GameTable.tsx` | 1, 2, 3, 4, 5, 6 |
| `components/cards/Card.tsx` | 2 |
| `components/cards/CardHand.tsx` | 2, 5 |
| `components/game/TrickPile.tsx` | 3, 6 |
| `components/game/PlayerSeat.tsx` | 3, 5 |

## Files NOT Modified
`lib/game-engine/`, `lib/socket/`, `store/`, `hooks/`, `types/`, `config/`

---

## Dependencies to Install

```bash
npm install gsap
```

GSAP is used only in `DealAnimation` (inside `GameTable.tsx`) and `TrickPile.tsx`. Import: `import { gsap } from 'gsap'`.

---

## Verification Checklist

- [ ] `npx tsc --noEmit` — zero errors after each task
- [ ] Deal animation shows all cards (6P1D = 8 cards, 6P2D = 16 cards), ends ~1.2s after last card
- [ ] Cards fully bright during bidding phase
- [ ] Table center clean: trump badge → trick pile → trick badge only
- [ ] 🙈 toggle works in all phases; auto-reveals only on play turn
- [ ] Landscape: two-column layout, card scroll column, 32px avatars, BidPanel visible
- [ ] Rotate back to portrait restores correct layout
