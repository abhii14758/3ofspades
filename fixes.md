# 3 of Spades — Bug Fixes & UI Overhaul Instructions

> **For Claude Code:** Read every referenced file BEFORE writing code. Run `npx tsc --noEmit` after every task. DO NOT change any socket events, game engine logic, or Zustand store logic.

---

## Overview of Issues

| # | Issue | File(s) |
|---|-------|---------|
| 1 | Deal animation ends too early (time-based, not card-count-based) | `components/game/GameTable.tsx` |
| 2 | Cards during bidding are dim/low-opacity — should be fully bright | `components/game/GameTable.tsx`, `components/cards/CardHand.tsx` |
| 3 | Game table is cluttered / fonts too dense — redesign table center HUD | `components/game/GameTable.tsx`, `components/game/TrickPile.tsx` |
| 4 | Hide (🙈) feature broken — overlay not rendering correctly | `components/game/GameTable.tsx` |
| 5 | Landscape mobile is not responsive | `components/game/GameTable.tsx`, `components/cards/CardHand.tsx`, `components/game/OpponentStrip.tsx` |

---

## TASK 1 — Fix Deal Animation (Card-Count-Based, Not Time-Based)

### Problem
`DealAnimation` caps `ROUNDS` using `Math.min(cardsPerPlayer, Math.floor(13 / (N * DEAL_INTERVAL)))` which stops the animation before all cards are dealt on larger decks. The client-side `dealRevealedCount >= myHand.length` trigger never fires, so the animation lingers.

### Root Cause
In `GameTable.tsx`, inside `DealAnimation`:
```ts
const ROUNDS = Math.min(cardsPerPlayer, Math.floor(13 / (N * DEAL_INTERVAL)));
```
This artificially caps rounds. For 6 players × 8 cards × 0.28s = 13.44s — already fine. But the cap also breaks the `onCardDealtToMe` count that drives `dealRevealedCount`.

### Fix

**Step 1:** In `components/game/GameTable.tsx`, find `DealAnimation` and replace the ROUNDS/totalCards block:

```ts
// REMOVE:
const ROUNDS = Math.min(cardsPerPlayer, Math.floor(13 / (N * DEAL_INTERVAL)));
const clampedRounds = Math.max(ROUNDS, cardsPerPlayer);
const totalCards = N * clampedRounds;
const totalDuration = totalCards * DEAL_INTERVAL;

// REPLACE WITH:
const ROUNDS = cardsPerPlayer; // always deal ALL cards — never cap
const totalCards = N * ROUNDS;
const totalDuration = totalCards * DEAL_INTERVAL;
```

**Step 2:** Replace all remaining `clampedRounds` references with `ROUNDS` in the same component (there are ~4 occurrences in the two `useEffect` hooks and the `useMemo`).

**Step 3:** In the outer `GameTable` component, ensure the auto-end fallback fires correctly. Find the fallback `useEffect`:

```ts
useEffect(() => {
  const expectedCards = myHand.length > 0
    ? myHand.length
    : (gameState.hands ? (Object.values(gameState.hands)[0]?.length ?? 0) : 0);
  if (gameState.phase === 'dealing' && !dealAnimDone && expectedCards > 0 && myHand.length >= expectedCards) {
    const t = setTimeout(() => setDealAnimDone(true), 600);
    return () => clearTimeout(t);
  }
}, [myHand.length, gameState.hands, gameState.phase, dealAnimDone]);
```

This should already exist — if not, add it. Also ensure `onComplete` fires `totalDuration * 1000 + 800` ms (add 800ms buffer instead of 600 for slower connections):

```ts
useEffect(() => {
  const t = setTimeout(onComplete, totalDuration * 1000 + 800);
  return () => clearTimeout(t);
}, [totalDuration, onComplete]);
```

**Step 4:** Verify `DealHandReveal` auto-ends after `dealRevealedCount >= myHand.length`:

```ts
useEffect(() => {
  if (dealRevealedCount > 0 && myHand.length > 0 && dealRevealedCount >= myHand.length) {
    const t = setTimeout(() => setDealAnimDone(true), 1200); // 1.2s after last card
    return () => clearTimeout(t);
  }
}, [dealRevealedCount, myHand.length]);
```

**Verification:** `npx tsc --noEmit` — zero errors. Test with 6P1D (8 cards) and 6P2D (16 cards) presets.

---

## TASK 2 — Cards During Bidding: Full Brightness, No Opacity Reduction

### Problem
During `phase === 'bidding'`, the `CardHand` and `Card` components reduce card opacity because `playable` is `false` (no `playableCardIds` are set). Cards appear dim and hard to read.

### Root Cause
In `Card.tsx`:
```tsx
className={clsx(
  'relative rounded-lg select-none',
  !playable && !selected && 'opacity-60',  // ← this dims cards during bidding
  ...
)}
```
In `CardHand.tsx`, `playableCardIds` is only set when `isMyTurn && phase === 'playing'`, so during bidding all cards get `playable={false}`.

### Fix

**Step 1: `components/cards/Card.tsx`** — Remove the opacity reduction for non-playable cards, or change it to only apply during `playing` phase. The simplest approach: pass a `dimIfNotPlayable` prop:

```tsx
interface CardProps {
  // ... existing props
  dimIfNotPlayable?: boolean; // defaults true, set false during bidding
}

// In the motion.div:
className={clsx(
  'relative rounded-lg select-none',
  !playable && !selected && dimIfNotPlayable && 'opacity-60',
  className
)}
```

**Step 2: `components/cards/CardHand.tsx`** — Add `dimIfNotPlayable` prop and pass it to `Card`:

```tsx
interface CardHandProps {
  // ... existing props
  dimIfNotPlayable?: boolean;
}

// Default: true. GameTable passes false during bidding.

// In the Card render:
<Card
  card={card}
  selected={isSelected}
  playable={isMyTurn && isPlayable}
  dimIfNotPlayable={dimIfNotPlayable ?? true}
  onClick={() => handleCardClick(card)}
  flat
/>
```

**Step 3: `components/game/GameTable.tsx`** — Pass `dimIfNotPlayable={false}` when in bidding phase:

```tsx
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
  dimIfNotPlayable={phase !== 'bidding'} // ← KEY FIX: full brightness during bidding
/>
```

**Step 4:** Also ensure the `expandedView` hint text is visible. The "View your cards to bid wisely" label should have `opacity: 1` and clear color. Verify this in `CardHand.tsx`.

**Verification:** During bidding, all 8 cards should be fully bright (same as when it's your turn to play).

---

## TASK 3 — Declutter the Game Table Center HUD

### Problem
The table center is overcrowded: trump badge, trick counter, trick pile cards, progress dots, and the "3 of Spades" emblem all stack on top of each other, causing a cluttered, hard-to-read experience — especially on mobile.

### Design Principles (from production card games like PokerStars, Rummy Circle, Zynga Poker):
- **Hierarchy**: Most important info (trump suit) is largest and centered
- **Spacing**: Generous whitespace between elements — never let items touch
- **Simplicity**: Trick count as a single badge, not text + dots combined
- **Cards**: Played cards in trick should be spread in a clean arc, not stacked

### Fix in `components/game/TrickPile.tsx`

**Step 1:** Replace the empty-state circle with a minimal emblem-only view:

```tsx
if (cards.length === 0) {
  return (
    <div className="flex flex-col items-center gap-2 pointer-events-none">
      {completedTricksCount > 0 && (
        <div
          className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold"
          style={{
            background: 'rgba(0,0,0,0.5)',
            border: '1px solid rgba(212,160,23,0.3)',
            color: 'rgba(212,160,23,0.9)',
            backdropFilter: 'blur(4px)',
          }}
        >
          <span style={{ fontSize: 10 }}>Trick</span>
          <span style={{ fontSize: 14, fontWeight: 900 }}>{completedTricksCount}</span>
          <span style={{ fontSize: 10, opacity: 0.6 }}>/ {totalTricks}</span>
        </div>
      )}
    </div>
  );
}
```

**Step 2:** For played cards in trick, spread them horizontally with consistent spacing. Reduce card size slightly to `width: 44, height: 62` and increase the gap between cards so they never overlap:

```tsx
<div className="flex items-end gap-2 flex-wrap justify-center px-2 max-w-xs">
```

**Step 3:** Remove the separate dots progress bar from below the trick pile — it creates visual clutter. Replace with the single badge approach above.

**Step 4:** Remove the "Trick X/Y" text label from `GameTable.tsx` center (around `completedTricks.length > 0 && <motion.p>Trick {n}/{t}</motion.p>`) — the badge in TrickPile handles this now.

### Fix in `components/game/GameTable.tsx` — Table Center HUD

**Step 1:** The center `<div className="absolute inset-0 flex items-center justify-center pointer-events-none">` currently has two layered divs (emblem + trump+trick). Restructure to:

```tsx
{/* Table center — clean vertical stack */}
<div className="absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none" style={{ zIndex: 1 }}>
  
  {/* Trump badge — ONLY when trump is selected */}
  <AnimatePresence>
    {trumpSuit && (
      <motion.div
        key={trumpSuit}
        initial={{ scale: 0.7, opacity: 0, y: -8 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.7, opacity: 0 }}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full font-bold text-sm backdrop-blur-sm"
        style={{
          background: 'rgba(0,0,0,0.65)',
          border: trumpSuit === 'hearts' || trumpSuit === 'diamonds'
            ? '1.5px solid rgba(239,68,68,0.6)'
            : '1.5px solid rgba(212,160,23,0.5)',
          color: trumpSuit === 'hearts' || trumpSuit === 'diamonds' ? '#fca5a5' : '#fbbf24',
          boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
        }}
      >
        <span style={{ fontSize: 18 }}>{SUIT_SYMBOLS[trumpSuit]}</span>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', opacity: 0.85 }}>
          TRUMP
        </span>
      </motion.div>
    )}
  </AnimatePresence>

  {/* Trick pile — cards played this trick */}
  <TrickPile
    trick={currentTrick}
    players={players}
    trumpSuit={trumpSuit}
    completedTricksCount={completedTricks.length}
    totalTricks={totalTricks}
  />

</div>
```

**Step 2:** Remove the gold emblem (double-ring ♠ circle) from the table center — it creates visual noise when cards are present. Keep it ONLY when `phase === 'dealing'` or `phase === 'bidding'` (no cards on table):

```tsx
{/* Center emblem — visible only when table is empty */}
{(!currentTrick || currentTrick.cards.length === 0) && phase !== 'playing' && (
  <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 0 }}>
    <div style={{
      width: 90, height: 90, borderRadius: '50%',
      border: '1.5px solid rgba(212,160,23,0.3)',
      background: 'radial-gradient(circle, rgba(212,160,23,0.06) 0%, transparent 70%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
    }}>
      <span style={{ fontSize: 24, opacity: 0.35, color: '#d4a017' }}>♠</span>
      <span style={{ fontSize: 7, opacity: 0.3, color: '#d4a017', fontWeight: 700, letterSpacing: '0.15em' }}>3 OF SPADES</span>
    </div>
  </div>
)}
```

**Step 3:** Reduce font sizes in PlayerSeat name badges. In `components/game/PlayerSeat.tsx`, reduce the score text and name text:

```tsx
// Name span: change text-xs to text-[11px]
// Score span: change text-xs to text-[10px]
// Card count badge: keep at text-xs
// Ensure max-w-[72px] on name to prevent overflow
```

**Step 4:** In `components/game/BidPanel.tsx`, the bid panel currently uses `absolute inset-x-0 top-1/2 -translate-y-1/2`. On smaller screens this overlaps player seats. Change to a fixed max-height and scroll:

```tsx
// In GameTable.tsx, BidPanel wrapper:
<div className="absolute inset-x-0 top-1/2 -translate-y-1/2 z-20 flex justify-center pointer-events-none px-4"
     style={{ maxHeight: '80%' }}>
  <div className="pointer-events-auto w-full max-w-sm overflow-y-auto" style={{ maxHeight: '100%' }}>
    <BidPanel ... />
  </div>
</div>
```

**Verification:** The table should show: trump badge (clean, not overwhelming) + played cards in neat row + trick count badge. No overlapping text.

---

## TASK 4 — Fix Hide Cards Feature (🙈 Button)

### Problem
The hide overlay (`handHidden` state) doesn't render over the cards correctly. The condition was `handHidden && !(isMyTurn && phase === 'playing')` which means it only hides during non-play phases. When it IS your turn, the overlay disappears (good), but the toggle button doesn't re-hide correctly after your turn.

### Fix in `components/game/GameTable.tsx`

**Step 1:** The hide overlay currently sits inside the `<div className="relative">` wrapping `CardHand`. Verify the z-index is correct. The overlay div must have `z-index: 10` and `position: absolute`:

```tsx
{/* CardHand is ALWAYS mounted to preserve sort order */}
<div className="relative">
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
    dimIfNotPlayable={phase !== 'bidding'}
  />
  
  {/* Hide overlay — renders ON TOP when handHidden is true */}
  {handHidden && (
    <div
      className="absolute inset-0 z-10 flex items-center justify-center gap-1 flex-wrap px-3 py-2"
      style={{
        background: 'linear-gradient(to top, rgba(0,0,0,0.96) 0%, rgba(0,0,0,0.88) 100%)',
        minHeight: '100px',
      }}
    >
      {myHand.map((_, i) => (
        <div
          key={i}
          style={{
            width: isMobile ? 40 : 48,
            height: isMobile ? 58 : 70,
            borderRadius: 8,
            background: 'linear-gradient(145deg, #1a2850 0%, #1e3570 55%, #243f8a 100%)',
            border: '1px solid rgba(100,140,255,0.45)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.6)',
            flexShrink: 0,
          }}
        />
      ))}
      <p className="w-full text-center text-[11px] text-slate-500 mt-1 select-none">
        Cards hidden — tap 👁️ to reveal
      </p>
    </div>
  )}
</div>
```

**Step 2:** The auto-reveal `useEffect` — ensure it ONLY auto-reveals when it's your turn to PLAY (not during bidding):

```tsx
useEffect(() => {
  // Auto-reveal only when it's actually time for you to play a card
  if (isMyTurn && phase === 'playing') {
    setHandHidden(false);
  }
}, [isMyTurn, phase]);
```

**Step 3:** The hide button in the top bar should toggle `handHidden` regardless of phase. Verify the button click handler is `() => setHandHidden(v => !v)` with no phase guard.

**Step 4:** Reset `handHidden` to `false` when the phase changes to `dealing` (new round starts):

```tsx
useEffect(() => {
  if (gameState.phase === 'dealing') {
    setDealAnimDone(false);
    setDealRevealedCount(0);
    setHandHidden(false); // ← ADD THIS
  }
}, [gameState.phase]);
```

**Verification:** 
- Click 🙈 → cards replaced by blue card backs
- Click 👁️ → cards revealed  
- Works in all phases: bidding, playing (when not your turn), waiting
- Auto-reveals only when it becomes YOUR turn to play a card

---

## TASK 5 — Mobile Landscape Responsiveness

### Problem
When the phone is rotated to landscape, the game table is too tall, player seats overflow, and card hand is cut off. The `isMobile` check only looks at width (`< 640px`), missing landscape orientation.

### Design Reference
Production mobile card games (Ludo King, Rummy Circle, Teen Patti Gold) in landscape:
- Table shrinks to ~40vh height
- Player avatars scaled down to 32px
- Card hand uses compact horizontal scroll
- No side chat panel — only bottom drawer

### Fix in `components/game/GameTable.tsx`

**Step 1:** Update the `isMobile` / `isTablet` detection to handle landscape orientation:

```tsx
useEffect(() => {
  const check = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    // Landscape phone: wide but short (e.g. 667×375, 812×375)
    const isLandscapePhone = w >= 480 && h < 500 && w > h;
    // Portrait phone
    const isPortraitPhone = w < 640;
    const mobile = isPortraitPhone || isLandscapePhone;
    setIsMobile(mobile);
    setIsTablet(!mobile && w >= 640 && w < 1024);
  };
  check();
  window.addEventListener('resize', check);
  window.addEventListener('orientationchange', check);
  return () => {
    window.removeEventListener('resize', check);
    window.removeEventListener('orientationchange', check);
  };
}, []);
```

**Step 2:** Add an `isLandscape` state:

```tsx
const [isLandscape, setIsLandscape] = useState(false);

// In the check() function above:
setIsLandscape(window.innerWidth > window.innerHeight);
```

**Step 3:** Update casino table dimensions for landscape mobile:

```tsx
style={{
  width: isMobile
    ? isLandscape ? '70vw' : '96vw'
    : isTablet ? 'min(94vw, 760px)' : 'min(94vw, 920px)',
  height: isMobile
    ? isLandscape ? 'min(85vh, 340px)' : 'auto'
    : isTablet ? 'min(50vh, 380px)' : 'min(52vh, 480px)',
  aspectRatio: isMobile && !isLandscape ? '2/1' : undefined,
  minHeight: isMobile ? isLandscape ? '200px' : '180px' : '260px',
  perspective: isMobile ? '600px' : '900px',
  transformStyle: 'preserve-3d',
}}
```

**Step 4:** In landscape mobile, the full layout should switch to a side-by-side mode:

```tsx
{/* Main layout wrapper */}
<div
  className="flex overflow-hidden select-none"
  style={{
    height: '100dvh',
    flexDirection: isMobile && isLandscape ? 'row' : 'column',
    background: 'radial-gradient(ellipse 160% 120% at 50% 60%, #071507 0%, #020802 40%, #000000 100%)',
  }}
>
  {/* Game section */}
  <div
    className="flex flex-col overflow-hidden min-w-0"
    style={{ flex: 1 }}
  >
    {/* Top bar */}
    ...
    
    {/* Opponent strip — show in ALL mobile orientations */}
    {isMobile && (
      <OpponentStrip ... />
    )}
    
    {/* Table area */}
    <div
      className="flex-1 relative flex items-center justify-center overflow-hidden min-h-0"
      style={{
        padding: isMobile && isLandscape ? '2px' : '4px',
      }}
    >
      ...
    </div>
    
    {/* Card hand — in landscape, render in a side column */}
  </div>
  
  {/* Landscape: card hand as right column */}
  {isMobile && isLandscape && (
    <div
      className="shrink-0 flex flex-col justify-end overflow-hidden"
      style={{
        width: '32vw',
        background: 'linear-gradient(to left, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.7) 100%)',
        borderLeft: '1px solid rgba(255,255,255,0.05)',
      }}
    >
      {/* Card hand in landscape — vertical scroll */}
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
        compact={true}
        dimIfNotPlayable={phase !== 'bidding'}
      />
    </div>
  )}
</div>
```

**Step 5:** Hide the bottom card hand when in landscape (since it's rendered in the side column). In the existing card hand section, guard it:

```tsx
{/* Bottom card hand — portrait only */}
{!(isMobile && isLandscape) && (
  <div className="shrink-0 z-10 pt-1 pb-3" style={{ ... }}>
    {/* existing CardHand JSX */}
  </div>
)}
```

**Step 6:** In `components/cards/CardHand.tsx`, handle the case where it's rendered in a narrow side column. Add a `vertical` prop for landscape:

```tsx
interface CardHandProps {
  // ... existing
  vertical?: boolean; // when true, lay cards vertically in a scrollable column
}
```

When `vertical` is true, render cards in a single column instead of a fan:

```tsx
if (vertical) {
  return (
    <div className="flex flex-col items-center gap-1 overflow-y-auto h-full px-1 py-2">
      {orderedCards.map((card, i) => {
        const isSelected = selectedCardId === card.id;
        const isPlayable = !playableCardIds || playableCardIds.has(card.id);
        return (
          <Card
            key={card.id}
            card={card}
            selected={isSelected}
            playable={isMyTurn && isPlayable}
            dimIfNotPlayable={false}
            onClick={() => handleCardClick(card)}
            small={true}
          />
        );
      })}
    </div>
  );
}
```

**Step 7:** Top bar in landscape — reduce padding and font sizes:

```tsx
<motion.div
  className="shrink-0 flex items-center gap-1.5 z-20 bg-black/50 backdrop-blur-sm border-b border-white/5"
  style={{
    padding: isMobile && isLandscape ? '2px 8px' : '8px 12px',
  }}
>
```

**Step 8:** PlayerSeat compact mode in landscape — reduce avatar to 32px:

```tsx
// In PlayerSeat.tsx, add an extraCompact prop:
interface PlayerSeatProps {
  // ...
  extraCompact?: boolean; // 32px avatar for landscape
}

// Avatar div:
<div className="relative" style={{ width: extraCompact ? 32 : compact ? 36 : 48, height: extraCompact ? 32 : compact ? 36 : 48 }}>
```

Pass `extraCompact={isMobile && isLandscape}` from GameTable.

**Verification:**
- Rotate to landscape on iOS Safari / Android Chrome
- Table visible, not cut off
- Cards in right column, scrollable
- Player avatars visible around table
- BidPanel readable
- Rotating back to portrait works correctly

---

## TASK 6 — Additional Polish (Run After All Above Tasks)

### 6a: Ensure BidPanel doesn't block cards

In `components/game/GameTable.tsx`, the BidPanel is inside the table area. Confirm this is `absolute` positioned, not `fixed`:

```tsx
{showBidPanel && (
  <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 z-20 flex justify-center pointer-events-none px-4">
    <div className="pointer-events-auto w-full max-w-sm">
      <BidPanel ... />
    </div>
  </div>
)}
```

### 6b: Trick pile card sizing — consistent across screen sizes

In `components/game/TrickPile.tsx`:
```tsx
// Card dimensions — responsive
const TRICK_CARD_W = 48;
const TRICK_CARD_H = 68;
```

### 6c: Partner cards bar — fix layout on mobile

In `GameTable.tsx`, the partner cards bar above the hand should wrap correctly on mobile:

```tsx
<div className="flex items-center justify-center gap-1.5 mb-1.5 px-3 flex-wrap">
  <span className="text-[11px] text-slate-400 shrink-0 font-medium">
    {bidWinnerId === myPlayerId ? '🤝 Your partner cards:' : '🤝 Partner cards:'}
  </span>
  {calledCards.map((card) => {
    // existing pill badges
  })}
</div>
```

---

## TypeScript Verification

After ALL tasks:

```bash
npx tsc --noEmit
```

Expected: zero errors. Fix any prop type mismatches before committing.

---

## Testing Checklist

After implementation, test each scenario:

**Deal Animation:**
- [ ] 6P1D (8 cards): Animation shows all 8 cards arriving, ends ~1s after last card
- [ ] 6P2D (16 cards): Animation shows all 16 cards, ends properly
- [ ] Skip deal button works and ends animation immediately

**Bidding Cards:**
- [ ] Cards at bottom are fully bright during bidding (no opacity-60)
- [ ] Bidding hint text visible above cards
- [ ] BidPanel visible and interactive
- [ ] Cards BELOW the bid panel, not covered

**Table Declutter:**
- [ ] Trump badge clean and readable
- [ ] Trick pile cards spread in a row, not stacked
- [ ] No overlapping text elements
- [ ] Emblem only visible when table is empty

**Hide Feature:**
- [ ] 🙈 click → cards show as blue card backs
- [ ] 👁️ click → cards revealed
- [ ] Hides correctly in bidding phase
- [ ] Hides correctly when waiting for others to play
- [ ] Auto-reveals ONLY when it's your turn to play

**Mobile Landscape:**
- [ ] Table fits within screen, not cut off
- [ ] Cards visible in side column (or bottom — scrollable)
- [ ] Player seats visible with smaller avatars
- [ ] Bid panel visible and not overlapping
- [ ] Rotating back to portrait works

---

## Reference Design Notes

Based on production card games (PokerStars Mobile, Rummy Circle, Teen Patti Gold):

1. **Table center**: Minimal — only what's happening RIGHT NOW (current played cards + trump). Not a dashboard.
2. **Card hand**: Always full brightness. Dimming = confusion. Indicate unplayable via border color, not opacity.
3. **Mobile landscape**: Two-column layout is the industry standard — table left, hand right. See: PokerStars, 8 Ball Pool.
4. **Animations**: Tied to content count, never time. A slow connection shouldn't skip cards.
5. **Hide feature**: The hide overlay must be a proper z-index overlay, not a conditional unmount. Using `visibility: hidden` or `opacity: 0` on CardHand and replacing with the overlay is more reliable than trying to render on top.

---

## Files Modified Summary

| File | Tasks |
|------|-------|
| `components/game/GameTable.tsx` | 1, 2, 3, 4, 5 |
| `components/cards/Card.tsx` | 2 |
| `components/cards/CardHand.tsx` | 2, 5 |
| `components/game/TrickPile.tsx` | 3 |
| `components/game/PlayerSeat.tsx` | 5 |
| `components/game/OpponentStrip.tsx` | 5 |

**DO NOT MODIFY:**
- `lib/game-engine/` — pure game logic
- `lib/socket/socketClient.ts` — socket events
- `lib/socket/socketServer.ts` — server logic
- `store/` — Zustand stores
- `hooks/` — custom hooks
- `types/` — TypeScript types
- `config/gameConfig.ts` — game config