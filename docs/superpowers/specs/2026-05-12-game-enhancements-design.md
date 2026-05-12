# Game Enhancements Design — 2026-05-12

## Overview

Five targeted improvements to the 3 of Spades / Kali Teeri game:
1. Chat panel UI fix (side-by-side layout)
2. 3D table UI overhaul (match reference image)
3. Animated male dealer figure (SVG, separate from players)
4. Partner reveal deep fix (server + client)
5. Score display logic (individual until revealed, combined after)

---

## 1. Chat Panel Layout Fix

### Problem
`ChatPanel` uses `position: fixed; right: 0; top: 0; height: 100%` — this causes it to overlap the game table and clip at the bottom on some screen sizes (as seen in screenshot).

### Solution
Remove all `fixed` positioning from `ChatPanel`. Restructure `GameTable.tsx` outer wrapper:

```
<div className="flex flex-row h-[100dvh] overflow-hidden">
  {/* Game section — shrinks when chat open */}
  <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
    {/* top bar, table area, card hand */}
  </div>

  {/* Chat panel — AnimatePresence slide from right */}
  <AnimatePresence>
    {chatOpen && (
      <motion.div
        initial={{ width: 0, opacity: 0 }}
        animate={{ width: 280, opacity: 1 }}
        exit={{ width: 0, opacity: 0 }}
        className="shrink-0 flex flex-col border-l border-slate-700 bg-slate-900 overflow-hidden"
        style={{ width: 280 }}
      >
        <ChatPanel ... />
      </motion.div>
    )}
  </AnimatePresence>
</div>
```

**Mobile (`< 640px`):** Chat becomes a bottom drawer:
- `fixed bottom-0 inset-x-0` with `height: 55vh`
- Slides up (`y: '100%' → 0`) using AnimatePresence
- Backdrop overlay (`bg-black/50`) behind it
- Detect via `isMobile` state hook already present in `GameTable`

**ChatPanel component changes:**
- Remove `fixed right-0 top-0 h-full w-72` classes
- ChatPanel becomes a pure `flex flex-col h-full` container
- The unread badge stays on the Chat button in the top bar
- Messages area: `flex-1 overflow-y-auto` (fills available height correctly)

---

## 2. 3D Table UI — Match Reference Image

### Reference
`D:\3ofspades\create-fullview-3d-game-table-260nw-2773268507.webp`

### Key Visual Elements from Reference
- **Perspective tilt**: Table appears tilted ~15° toward viewer (3D bird's-eye)  
- **Very thick gold/amber rim**: Dominant visual, ~3% of table width, bright `#d4a017` with strong glow
- **Bright kelly green felt**: `#1a7a3e` to `#155f32` gradient (much brighter than current dark green)
- **Mahogany wood base**: Dark `#2a0f05` → `#1a0800` gradient visible at table edge
- **Player nameplates**: Gold/amber badge panels embedded at each seat position in the rim
- **Center emblem**: Circular gold ring with game logo or suit symbol in center
- **Dark vignette room**: Near-black with subtle warm ambient light from above

### CSS/Layout Changes in `GameTable.tsx`

```css
/* Table container — add 3D tilt */
style={{
  perspective: '1200px',
  transform: 'rotateX(12deg)',
  transformOrigin: 'center 60%',
}}

/* Gold rim */
background: 'linear-gradient(145deg, #d4a017 0%, #9a7010 40%, #c89020 70%, #7a5808 100%)'
boxShadow: '0 0 0 3px #f0c040, 0 0 30px rgba(212,160,23,0.5), 0 0 60px rgba(212,160,23,0.2)'

/* Felt — brighter kelly green */
background: 'radial-gradient(ellipse at 50% 40%, #1e8040 0%, #176030 40%, #0f4822 70%, #083018 100%)'

/* Center emblem */
<div style={{
  width: 80, height: 80, borderRadius: '50%',
  border: '3px solid rgba(212,160,23,0.6)',
  background: 'radial-gradient(circle, rgba(212,160,23,0.1) 0%, transparent 70%)',
  display: 'flex', alignItems: 'center', justifyContent: 'center'
}}>
  <span style={{ fontSize: 32, opacity: 0.4 }}>♠</span>
</div>
```

### Player Nameplates
At each player seat position (computed from polar math), render a small nameplate badge embedded in the gold rim:
- `background: linear-gradient(#c89020, #9a6808)`
- `border: 1px solid #f0d060`
- Shows player name + score, replacing the floating seat that currently clips outside the table

---

## 3. Animated Male Dealer Figure

### Position
The dealer is a **separate SVG component** (`DealerFigure`) positioned at the top-center of the table (12 o'clock), between the top player seats. It does NOT occupy a player slot. The "D" chip is removed.

```jsx
// Position: center-top of the table, slightly inside the felt
style={{ left: '50%', top: '4%', transform: 'translate(-50%, 0)' }}
```

### SVG Character Design (inline SVG, ~200×260px)
Stylized male dealer:
- **Body**: Dark vest (`#1a1a2e`) with white shirt visible at collar/cuffs
- **Bow tie**: Small black butterfly at collar
- **Dealer visor**: Green visor (`#1a6b2a`) above eyes, with gold band
- **Head**: Skin-tone circle with simplified facial features (eyes, smile)
- **Arms**: Two arms hanging at sides at rest; left arm extends forward during dealing

### Animations (Framer Motion)
```typescript
// Idle: subtle vertical breathing sway
animate={{ y: [0, -3, 0] }}
transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}

// Dealing phase: right arm extend + card fly
// When phase === 'dealing': armRotate animates 0 → -45 → 0
```

**Arm animation during dealing:**
- Right arm rotates from resting position forward (as if tossing cards)
- Synced with `DealAnimation` card fly effect
- Returns to idle when `phase !== 'dealing'`

### Component File
`components/game/DealerFigure.tsx` — standalone, takes `{ isDealing: boolean }` prop.

---

## 4. Partner Reveal — Deep Fix

### Current Bug
Partner is not highlighted when they play the called card. Root cause investigation needed:

1. **`afterPartnersSelected`** in `roundEngine.ts` — normalizes called card IDs to type IDs (`suit_rank`). Verify this correctly strips `_0`/`_1` suffixes for double-deck.

2. **`processCardPlay`** in `roundEngine.ts` — checks if played card matches `calledCards` using `card.id === cc.id || card.id.startsWith(cc.id + '_')`. Verify this check fires and adds the player to `revealedPartnerIds`.

3. **`syncStateToAll`** in `socketServer.ts` — verify `revealedPartnerIds` is included in `getPublicGameState` output (not being stripped).

4. **Client `applyPartnerRevealed`** in `gameStore.ts` — verify the socket event `game:partnerRevealed` fires and updates `revealedPartnerIds` locally.

5. **`PlayerSeat` `isPartner` prop** — verify it reads from `revealedPartnerIds` (not from `partnerIds` or teams).

### Fix Strategy
Add `console.log` traces server-side to verify the reveal fires, then ensure the public state always includes `revealedPartnerIds`. Add a server-side unit test to `__test_flow.ts`.

---

## 5. Score Display Logic

### Rules
- **Before any partner reveal**: All players show their own individual trick points
- **After partner reveal**: The bid winner + all revealed partners show ONE combined score (same number beside all their names), colored sky-blue
- **Team B / unrevealed players**: Always show their own individual score, colored orange

### Implementation (already partially done in `GameTable.tsx`)
Verify `getDisplayPoints(playerId)` and `getPlayerTeamId(playerId)` are correct:

```typescript
const revealedTeamAIds = [bidWinnerId, ...revealedPartnerIds].filter(Boolean);
const teamACombinedPoints = revealedTeamAIds.reduce(
  (sum, id) => sum + (playerIndividualPoints[id] ?? 0), 0
);

function getDisplayPoints(playerId: string): number {
  if (revealedTeamAIds.includes(playerId)) return teamACombinedPoints;
  return playerIndividualPoints[id] ?? 0;  // individual
}
```

Verify `PlayerSeat` renders this correctly with `(combined)` label for Team A.

---

## Files to Change

| File | Change |
|------|--------|
| `components/game/GameTable.tsx` | Flex-row layout, 3D table styles, DealerFigure integration, chat restructure |
| `components/game/ChatPanel.tsx` | Remove `fixed` positioning, become `flex flex-col h-full` |
| `components/game/DealerFigure.tsx` | NEW — SVG male dealer character with Framer Motion animations |
| `lib/game-engine/roundEngine.ts` | Verify/fix partner reveal detection |
| `lib/socket/socketServer.ts` | Verify `revealedPartnerIds` in public state |
| `store/gameStore.ts` | Verify `applyPartnerRevealed` fires correctly |

---

## Non-Goals
- No changes to game rules, scoring algorithm, or deck engine
- No new socket events (use existing `game:partnerRevealed`)
- No changes to lobby, room page, or other screens
- No new npm dependencies
