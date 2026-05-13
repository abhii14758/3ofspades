# Double-Deck Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement 7 targeted fixes for double-deck game modes: card identity (deckColor), partner selection/reveal by type, trick engine (remove 3♠ supreme + last-duplicate-wins), absolute seat positioning, Play Again score persistence, and winner dialog scroll.

**Architecture:** Foundation change first (deckColor on Card type + deck IDs), then engine logic (trick + partner), then UI (PartnerSelector + GameTable seats + WinnerScreen + Play Again). Each task is independently testable and committable.

**Tech Stack:** TypeScript, Next.js 16, React 19, Socket.io, Zustand, Tailwind CSS

---

## File Map

| File | Change |
|------|--------|
| `types/index.ts` | Add `deckColor: "red" \| "blue"` to `Card` |
| `lib/game-engine/deck.ts` | New card ID format (`red_suit_rank`), add `deckColor` field |
| `lib/game-engine/botEngine.ts` | Update `buildFullDeck()`, remove 3♠ special value, fix `toTypeId()` |
| `lib/game-engine/trickEngine.ts` | Remove 3♠ override, add last-duplicate-wins tie-break |
| `lib/game-engine/roundEngine.ts` | Use `getCardTypeId()` in partner matching + reveal, support count=2 dupes |
| `lib/game-engine/ruleValidator.ts` | Allow duplicate typeIds (count=2), add per-typeId max-copies check |
| `lib/socket/socketServer.ts` | Fix bidder-card check, add `game:playAgain` handler |
| `lib/socket/socketClient.ts` | Add `playAgain` emit |
| `components/game/PartnerSelector.tsx` | Add `deckCount` prop, "both copies" toggle for double-deck |
| `components/game/GameTable.tsx` | Replace ellipse positions with absolute seatIndex-based layout |
| `components/game/WinnerScreen.tsx` | Add `maxHeight: 90vh, overflowY: auto` to outer container |
| `app/game/[roomId]/page.tsx` | Wire `onPlayAgain` to emit `game:playAgain` instead of redirect |

---

## Task 1: Card Identity — `deckColor` field + new ID format

**Files:**
- Modify: `types/index.ts`
- Modify: `lib/game-engine/deck.ts`

- [ ] **Step 1: Add `deckColor` to Card interface**

Open `types/index.ts` and replace:
```ts
export interface Card {
  id: string;
  suit: Suit;
  rank: Rank;
  points: number;
}
```
with:
```ts
export interface Card {
  id: string;
  suit: Suit;
  rank: Rank;
  points: number;
  deckColor: 'red' | 'blue';
}
```

- [ ] **Step 2: Update `createDeck()` in deck.ts**

Open `lib/game-engine/deck.ts`. Replace the `createDeck` function body:

```ts
export function createDeck(config: GameConfig): Card[] {
  const count = config.deckCount ?? 1;
  const COLOR: Array<'red' | 'blue'> = ['red', 'blue'];
  const deck: Card[] = [];

  for (let d = 0; d < count; d++) {
    const deckColor = COLOR[d] ?? 'red';
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        if (config.removedRanks.includes(rank)) continue;
        // Single-deck: id = "red_suit_rank"  Double-deck: "red_suit_rank" / "blue_suit_rank"
        const id = count === 1 ? `red_${suit}_${rank}` : `${deckColor}_${suit}_${rank}`;
        deck.push({
          id,
          suit,
          rank,
          deckColor: count === 1 ? 'red' : deckColor,
          points: getCardPoints({ suit, rank }, config),
        });
      }
    }
  }
  return deck;
}
```

Also update the JSDoc comment for `createDeck`:
```ts
/**
 * Creates the deck(s) based on config.deckCount.
 * - Single deck (deckCount=1): IDs are `red_suit_rank` (48 cards, all deckColor="red")
 * - Double deck (deckCount=2): IDs are `red_suit_rank` and `blue_suit_rank` (96 cards)
 */
```

Update `validateDeckIntegrity` JSDoc (no code change needed, just the comment):
```ts
/**
 * Validates deck integrity: correct total count and no duplicate IDs.
 * Expected = 4 suits × 12 ranks × deckCount.
 */
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd D:\3ofspades && npx tsc --noEmit 2>&1 | head -50`

Expected: errors only in files downstream of `Card.deckColor` — these will be fixed in subsequent tasks. The key check: no errors in `deck.ts` or `types/index.ts` themselves.

- [ ] **Step 4: Commit**

```bash
git add types/index.ts lib/game-engine/deck.ts
git commit -m "feat: add deckColor field to Card type, update deck IDs to red/blue_suit_rank format

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 2: Fix Trick Engine

**Files:**
- Modify: `lib/game-engine/trickEngine.ts`
- Modify: `lib/game-engine/botEngine.ts`

- [ ] **Step 1: Remove 3♠ supreme override from `cardBeats()`**

Open `lib/game-engine/trickEngine.ts`. Delete lines 25-27 (the 3♠ special override):

```ts
// DELETE THESE TWO LINES:
  if (challenger.rank === '3' && challenger.suit === 'spades') return true;
  if (current.rank === '3' && current.suit === 'spades') return false;
```

- [ ] **Step 2: Add last-duplicate-wins tie-break**

In `cardBeats()`, find the section that compares two lead-suit cards:
```ts
  if (cIsLead && wIsLead) {
    return RANK_ORDER.indexOf(challenger.rank) > RANK_ORDER.indexOf(current.rank);
  }
```

Replace with:
```ts
  if (cIsLead && wIsLead) {
    const rankDiff = RANK_ORDER.indexOf(challenger.rank) - RANK_ORDER.indexOf(current.rank);
    if (rankDiff !== 0) return rankDiff > 0;
    // Same rank + same suit (double-deck duplicate): last played wins
    return challenger.suit === current.suit;
  }
```

Also add the same tie-break for two trump cards:
```ts
  if (cIsTrump && wIsTrump) {
    const rankDiff = RANK_ORDER.indexOf(challenger.rank) - RANK_ORDER.indexOf(current.rank);
    if (rankDiff !== 0) return rankDiff > 0;
    // Same rank + trump suit duplicate: last played wins
    return challenger.suit === current.suit;
  }
```

- [ ] **Step 3: Update `resolveTrick` JSDoc**

Replace the comment block above `resolveTrick`:
```ts
/**
 * Determines the winner of a completed trick.
 *
 * - Trump beats non-trump (when `trumpSuit` is set).
 * - Highest trump wins if multiple trump cards are played.
 * - Highest card of lead suit wins when no trump is played.
 * - Rank order: 3 < 4 < 5 < 6 < 7 < 8 < 9 < 10 < J < Q < K < A
 * - Duplicate cards (same rank + suit, double-deck): last played wins.
 *
 * Returns the `playerId` of the winner.
 */
```

- [ ] **Step 4: Fix botEngine — remove 3♠ special trick value**

Open `lib/game-engine/botEngine.ts`. In `getCardTrickValue()`, remove the 3♠ special case:

```ts
// DELETE these 3 lines:
  if (card.rank === '3' && card.suit === 'spades' && trumpSuit === 'spades') {
    return 2000;
  }
```

- [ ] **Step 5: Fix botEngine — update `buildFullDeck()` for new ID format + deckColor**

Replace the `buildFullDeck` function:
```ts
export function buildFullDeck(config: GameConfig): Card[] {
  const count = config.deckCount ?? 1;
  const colors: Array<'red' | 'blue'> = ['red', 'blue'];
  const cards: Card[] = [];

  for (let d = 0; d < count; d++) {
    const deckColor = colors[d] ?? 'red';
    for (const suit of ALL_SUITS) {
      for (const rank of ALL_RANKS) {
        const id = count === 1 ? `red_${suit}_${rank}` : `${deckColor}_${suit}_${rank}`;
        const points =
          config.cardValues[`${rank}_${suit}`] !== undefined
            ? config.cardValues[`${rank}_${suit}`]
            : config.cardValues[rank] !== undefined
              ? config.cardValues[rank]
              : 0;
        cards.push({ id, suit, rank, deckColor: count === 1 ? 'red' : deckColor, points });
      }
    }
  }
  return cards;
}
```

- [ ] **Step 6: Fix botEngine — update `toTypeId()` helper for new format**

In `botSelectPartnerCards`, the local `toTypeId` helper currently does `id.replace(/_[01]$/, '')`. Update it to strip the color prefix instead:

```ts
// Replace the local helper inside botSelectPartnerCards:
const toTypeId = (card: Card) => `${card.suit}_${card.rank}`;
const handTypeIds = new Set(hand.map(toTypeId));
```

And update the candidates loop to use the helper:
```ts
  for (const c of allCards) {
    const typeId = toTypeId(c);
    if (!handTypeIds.has(typeId) && !seenTypeIds.has(typeId)) {
      seenTypeIds.add(typeId);
      candidates.push({ ...c, id: typeId });
    }
  }
```

- [ ] **Step 7: Remove spades trump bonus comment in `botSelectTrump`**

Find and remove this comment (the bonus stays but the reason changes — 3♠ no longer has special power):
```ts
  // Slight spades preference: 3♠ (30 pts) is only useful as trump
```
Replace with:
```ts
  // Slight spades preference: historically strong suit
```

- [ ] **Step 8: Check TypeScript**

Run: `npx tsc --noEmit 2>&1 | head -50`

- [ ] **Step 9: Commit**

```bash
git add lib/game-engine/trickEngine.ts lib/game-engine/botEngine.ts
git commit -m "feat: remove 3♠ supreme override, add last-duplicate-wins in cardBeats, update botEngine deck format

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 3: Partner Logic — type-based matching + count=2 support

**Files:**
- Modify: `lib/game-engine/roundEngine.ts`
- Modify: `lib/game-engine/ruleValidator.ts`
- Modify: `lib/socket/socketServer.ts`

- [ ] **Step 1: Update `afterPartnersSelected()` in roundEngine.ts**

Add import at top of file (if not already imported):
```ts
import { createDeck, shuffleDeck, dealCards, getCardTypeId } from './deck';
```

Replace the entire `calledCards` construction and `partnerIds` loop in `afterPartnersSelected`:

```ts
export function afterPartnersSelected(
  gameState: GameState,
  calledCardTypeIds: string[], // type IDs like "spades_K"; duplicates allowed for count=2
): GameState {
  // Build display cards — one entry per UNIQUE type ID
  const uniqueTypeIds = [...new Set(calledCardTypeIds)];
  const allCards: Card[] = Object.values(gameState.hands).flat();

  const calledCards: Card[] = uniqueTypeIds.map((typeId) => {
    const found = allCards.find((c) => getCardTypeId(c) === typeId);
    if (!found) {
      const parts = typeId.split('_');
      const suit = parts[0] as Card['suit'];
      const rank = parts.slice(1).join('_') as Card['rank'];
      return { id: typeId, suit, rank, points: 0, deckColor: 'red' as const };
    }
    return { ...found, id: typeId };
  });

  // Find partners — one per slot in calledCardTypeIds (supports duplicate typeIds for count=2)
  const partnerIds: string[] = [];
  for (const typeId of calledCardTypeIds) {
    for (const [pid, hand] of Object.entries(gameState.hands)) {
      if (pid === gameState.bidWinnerId) continue;
      if (partnerIds.includes(pid)) continue; // already assigned
      const holds = hand.some((c) => getCardTypeId(c) === typeId);
      if (holds) {
        partnerIds.push(pid);
        break;
      }
    }
  }

  const allPlayerIds = gameState.players.map((p) => p.id);
  const teams = createInitialTeams(gameState.bidWinnerId!, partnerIds, allPlayerIds);

  teams.A.totalPoints = gameState.teams?.A.totalPoints ?? 0;
  teams.B.totalPoints = gameState.teams?.B.totalPoints ?? 0;

  const bidWinnerPlayer = gameState.players.find((p) => p.id === gameState.bidWinnerId);
  const leadPlayer = bidWinnerPlayer ?? getPlayerToLeftOfDealer(gameState.players, gameState.dealerIndex);
  const firstTrick = initTrick(0);

  return {
    ...gameState,
    phase: 'playing',
    calledCards,
    partnerCards: calledCards,
    partnerIds,
    teams,
    currentTrick: firstTrick,
    currentTurnPlayerId: leadPlayer.id,
  };
}
```

- [ ] **Step 2: Update partner reveal check in `processCardPlay()`**

In `processCardPlay`, find the `isCalledCard` check (around line 249) and replace:
```ts
  // OLD — prefix match:
  const isCalledCard = gameState.calledCards.some(
    (cc) => card.id === cc.id || card.id.startsWith(cc.id + '_'),
  );
```
with:
```ts
  // NEW — type-based match using suit+rank fields:
  const cardTypeId = getCardTypeId(card);
  const isCalledCard = gameState.calledCards.some((cc) => cc.id === cardTypeId);
```

- [ ] **Step 3: Update `validatePartnerSelection()` in ruleValidator.ts**

Replace the duplicate check and format validation loop:
```ts
export function validatePartnerSelection(
  gameState: GameState,
  playerId: string,
  cardIds: string[],
  config: GameConfig,
): { valid: boolean; error?: string } {
  if (gameState.phase !== 'partner_selection') {
    return { valid: false, error: 'Partner selection is not currently active.' };
  }

  if (gameState.bidWinnerId !== playerId) {
    return { valid: false, error: 'Only the bid winner may select partner cards.' };
  }

  if (cardIds.length !== config.partnerCount) {
    return {
      valid: false,
      error: `You must select exactly ${config.partnerCount} partner card(s).`,
    };
  }

  const validSuits = new Set(['spades', 'hearts', 'diamonds', 'clubs']);
  const validRanks = new Set(['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']);
  const deckCount = config.deckCount ?? 1;

  // Count occurrences of each typeId — max allowed = deckCount (can't pick more copies than exist)
  const typeCounts: Record<string, number> = {};
  for (const cardId of cardIds) {
    const underscoreIdx = cardId.indexOf('_');
    if (underscoreIdx === -1) {
      return { valid: false, error: `Invalid card ID format: "${cardId}".` };
    }
    const suit = cardId.substring(0, underscoreIdx);
    const rank = cardId.substring(underscoreIdx + 1);
    if (!validSuits.has(suit) || !validRanks.has(rank)) {
      return { valid: false, error: `Unknown card: "${cardId}".` };
    }
    typeCounts[cardId] = (typeCounts[cardId] ?? 0) + 1;
    if (typeCounts[cardId] > deckCount) {
      return { valid: false, error: `Cannot select more copies of "${cardId}" than exist in the deck.` };
    }
  }

  return { valid: true };
}
```

- [ ] **Step 4: Fix bidder-card check in `handleSelectPartners()` in socketServer.ts**

Add import of `getCardTypeId` at top of socketServer.ts (after existing game-engine imports):
```ts
import { getCardTypeId } from '@/lib/game-engine/deck';
```

Find the bidder-owns-card guard in `handleSelectPartners` (around line 491-497):
```ts
  // OLD:
  if (
    cardIds.some((typeId) =>
      bidWinnerHand.some((c) => c.id === typeId || c.id.startsWith(typeId + '_')),
    )
  )
    return false;
```

Replace with:
```ts
  // NEW — check using suit+rank (type-based) and respect deckCount
  const deckCount = cfg.deckCount ?? 1;
  const handTypeCounts: Record<string, number> = {};
  for (const c of bidWinnerHand) {
    const t = getCardTypeId(c);
    handTypeCounts[t] = (handTypeCounts[t] ?? 0) + 1;
  }
  // Count how many times each typeId appears in the selection
  const selectionCounts: Record<string, number> = {};
  for (const typeId of cardIds) {
    selectionCounts[typeId] = (selectionCounts[typeId] ?? 0) + 1;
  }
  // Reject if bidder holds ALL copies of any selected typeId at the requested count
  for (const [typeId, selectCount] of Object.entries(selectionCounts)) {
    const heldCount = handTypeCounts[typeId] ?? 0;
    if (heldCount + selectCount > deckCount) return false;
  }
```

- [ ] **Step 5: Check TypeScript**

Run: `npx tsc --noEmit 2>&1 | head -60`

Expected: no errors in the modified files. Fix any type errors if present.

- [ ] **Step 6: Commit**

```bash
git add lib/game-engine/roundEngine.ts lib/game-engine/ruleValidator.ts lib/socket/socketServer.ts
git commit -m "feat: partner matching uses type-based ID, support count=2 for double-deck

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 4: PartnerSelector UI — double-deck "both copies" toggle

**Files:**
- Modify: `components/game/PartnerSelector.tsx`

- [ ] **Step 1: Add `deckCount` prop and per-type copy tracking**

In `PartnerSelectorProps`, add:
```ts
interface PartnerSelectorProps {
  onSelect: (cardIds: string[]) => void;
  trumpSuit: Suit;
  myHand: CardType[];
  partnerCount?: number; // default 2
  deckCount?: number;    // default 1; pass 2 for double-deck modes
}
```

Update the component signature:
```ts
export default function PartnerSelector({
  onSelect,
  trumpSuit,
  myHand,
  partnerCount = 2,
  deckCount = 1,
}: PartnerSelectorProps) {
```

- [ ] **Step 2: Update hand type ID counting**

Replace:
```ts
  const myHandTypeIds = useMemo(() => new Set(myHand.map((c) => toTypeId(c.id))), [myHand]);
```
with:
```ts
  // Count how many copies of each typeId the bidder holds
  const myHandTypeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of myHand) {
      const t = `${c.suit}_${c.rank}`;
      counts[t] = (counts[t] ?? 0) + 1;
    }
    return counts;
  }, [myHand]);
```

- [ ] **Step 3: Update toggle logic to support count=2**

Replace the `selectedIds` state and `toggle` function:

```ts
  // selectedIds is an array of typeIds; duplicates allowed for count=2
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const toggleCard = (cardId: string) => {
    setSelectedIds((prev) => {
      const currentCount = prev.filter((id) => id === cardId).length;
      const heldCount = myHandTypeCounts[cardId] ?? 0;
      const maxSelectable = deckCount - heldCount; // can't pick what bidder holds

      if (currentCount === 0) {
        // Select once (if room in partnerCount)
        if (prev.length >= partnerCount) return [...prev.slice(1), cardId];
        return [...prev, cardId];
      } else if (currentCount === 1 && deckCount === 2 && maxSelectable >= 2) {
        // In double-deck, clicking again selects both copies
        if (prev.length >= partnerCount) return [...prev.slice(1), cardId];
        return [...prev, cardId];
      } else {
        // Deselect all copies of this card
        return prev.filter((id) => id !== cardId);
      }
    });
  };
```

- [ ] **Step 4: Update card button rendering**

Replace the `isInHand` variable and card button disabled logic:

```ts
                  const cardTypeId = `${suit}_${rank}`;
                  const isSelected = selectedIds.includes(cardTypeId);
                  const selectedCount = selectedIds.filter(id => id === cardTypeId).length;
                  const heldCount = myHandTypeCounts[cardTypeId] ?? 0;
                  const maxSelectable = deckCount - heldCount;
                  const isFullyInHand = maxSelectable <= 0; // bidder holds all copies
```

Update the button's `disabled` prop: `disabled={isFullyInHand}`
Update the button's `onClick`: `onClick={() => !isFullyInHand && toggleCard(cardTypeId)}`

Update the title: `title={isFullyInHand ? 'In your hand — cannot select' : selectedCount === 2 ? 'Both copies selected (click to deselect)' : undefined}`

For the "amber dot" at bottom right — show for partial hold (1 of 2 copies):
```tsx
                      {heldCount > 0 && (
                        <div className="absolute bottom-1 right-1 w-2 h-2 bg-amber-500 rounded-full"
                             title={`${heldCount}/${deckCount} in your hand`} />
                      )}
```

For double-deck "both selected" visual indicator, add a blue dot when `selectedCount === 2`:
```tsx
                      {selectedCount === 2 && (
                        <div className="absolute top-1 right-1 w-2 h-2 bg-sky-400 rounded-full" />
                      )}
```

- [ ] **Step 5: Update the confirm button label**

Replace the confirm button's label logic to show count info:
```ts
              ? `Confirm: ${[...new Set(selectedIds)].map((id) => {
                  const [s, r] = id.split('_') as [Suit, Rank];
                  const count = selectedIds.filter(x => x === id).length;
                  return `${r}${SUIT_SYMBOLS[s]}${count === 2 ? '×2' : ''}`;
                }).join(', ')}`
```

- [ ] **Step 6: Update `GameTable.tsx` to pass `deckCount` to `PartnerSelector`**

In `GameTable.tsx`, find where `PartnerSelector` is rendered and add `deckCount` prop. First find the `GameTableProps` interface and add `deckCount?: number` or derive it from config. The `GameTable` component is called from `page.tsx` where `roomGameConfig.deckCount` is available. Add to `GameTableProps`:

```ts
  deckCount?: number; // 1 or 2, for PartnerSelector
```

And pass it to `PartnerSelector`:
```tsx
              <PartnerSelector
                onSelect={onSelectPartners}
                trumpSuit={trumpSuit}
                myHand={myHand}
                partnerCount={partnerCount}
                deckCount={deckCount ?? 1}
              />
```

In `app/game/[roomId]/page.tsx`, pass `deckCount={roomGameConfig.deckCount}` to `<GameTable>`.

- [ ] **Step 7: Check TypeScript**

Run: `npx tsc --noEmit 2>&1 | head -60`

- [ ] **Step 8: Commit**

```bash
git add components/game/PartnerSelector.tsx components/game/GameTable.tsx app/game/[roomId]/page.tsx
git commit -m "feat: PartnerSelector supports both-copies selection in double-deck mode

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 5: Player Seat Absolute Positioning

**Files:**
- Modify: `components/game/GameTable.tsx`

- [ ] **Step 1: Replace `getPlayerPositions` with `getSeatPosition`**

In `GameTable.tsx`, replace the entire `getPlayerPositions` function (lines 67-86) with:

```ts
/**
 * Returns the absolute % position (left, top) for a seat at `seatIndex`
 * given a table with `totalSeats` players.
 *
 * Seat 0 is always bottom-center. Remaining seats go clockwise.
 * All players see the SAME layout regardless of who they are.
 */
function getSeatPosition(seatIndex: number, totalSeats: number): { x: number; y: number } {
  // Positions defined as [left%, top%] for each seatIndex
  const SEAT_MAPS: Record<number, Array<[number, number]>> = {
    4: [
      [50, 90], // 0 bottom-center
      [10, 50], // 1 left
      [50, 10], // 2 top-center
      [90, 50], // 3 right
    ],
    6: [
      [50, 90], // 0 bottom-center
      [15, 72], // 1 bottom-left
      [15, 28], // 2 top-left
      [50, 10], // 3 top-center
      [85, 28], // 4 top-right
      [85, 72], // 5 bottom-right
    ],
    8: [
      [50, 90], // 0 bottom-center
      [18, 78], // 1 bottom-left
      [8,  50], // 2 mid-left
      [18, 22], // 3 top-left
      [50, 10], // 4 top-center
      [82, 22], // 5 top-right
      [92, 50], // 6 mid-right
      [82, 78], // 7 bottom-right
    ],
    10: [
      [50, 92], // 0 bottom-center
      [24, 86], // 1 bottom-left
      [6,  68], // 2 mid-left
      [6,  32], // 3 far-left
      [24, 14], // 4 top-left
      [50, 8],  // 5 top-center
      [76, 14], // 6 top-right
      [94, 32], // 7 far-right
      [94, 68], // 8 mid-right
      [76, 86], // 9 bottom-right
    ],
  };

  const map = SEAT_MAPS[totalSeats] ?? SEAT_MAPS[6];
  const [x, y] = map[seatIndex % map.length] ?? [50, 50];
  return { x, y };
}
```

- [ ] **Step 2: Update the seat rendering loop**

In `GameTable.tsx`, find the block that renders player seats (currently uses `playerPositions.map(...)`). Replace it:

```tsx
          {/* Player seats — absolute by seatIndex, same layout for all players */}
          {players.map((player) => {
            const { x, y } = getSeatPosition(player.seatIndex, players.length);
            const isCurrentTurn = player.id === currentTurnPlayerId;
            const isPartner = revealedPartnerIds.includes(player.id);
            const cardCount = hands[player.id]?.length ?? 0;
            const trickCard = getTrickCard(player.id);
            const isLocalPlayer = player.id === myPlayerId;

            return (
              <div
                key={player.id}
                className="absolute"
                style={{
                  left: `${x}%`,
                  top: `${y}%`,
                  transform: 'translate(-50%, -50%)',
                  zIndex: isLocalPlayer ? 2 : 1,
                }}
              >
                <PlayerSeat
                  player={player}
                  cardCount={isLocalPlayer ? myHand.length : cardCount}
                  isCurrentTurn={isCurrentTurn}
                  isLocalPlayer={isLocalPlayer}
                  isPartner={isPartner}
                  isRevealed={isPartner}
                  isBidWinner={player.id === bidWinnerId && !!bidWinnerId}
                  trickCard={trickCard}
                  position="bottom"
                  compact={isMobile}
                  extraCompact={isMobile && isLandscape}
                  displayPoints={getDisplayPoints(player.id)}
                  teamId={getPlayerTeamId(player.id)}
                  turnTimerEndsAt={isCurrentTurn ? turnTimerEndsAt : null}
                  turnTimerTotalSeconds={turnTimerTotalSeconds}
                  showCombinedLabel={allPartnersRevealed && teamBIds.includes(player.id)}
                />
              </div>
            );
          })}
```

- [ ] **Step 3: Remove the old `getPlayerPositions` call and `playerPositions` variable**

Find where `playerPositions` is computed:
```ts
  const playerPositions = useMemo(
    () => getPlayerPositions(players, myPlayerId),
    [players, myPlayerId],
  );
```
Delete this `useMemo` call entirely (no longer needed).

- [ ] **Step 4: Verify TypeScript + visual check**

Run: `npx tsc --noEmit 2>&1 | head -30`

Then start the dev server: `npm run dev` and verify seats appear in correct absolute positions at different player counts.

- [ ] **Step 5: Commit**

```bash
git add components/game/GameTable.tsx
git commit -m "feat: player seats use absolute seatIndex-based positions, same layout for all players

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 6: Play Again — keep room + scores, restart round

**Files:**
- Modify: `lib/socket/socketServer.ts`
- Modify: `lib/socket/socketClient.ts`
- Modify: `app/game/[roomId]/page.tsx`

- [ ] **Step 1: Add `game:playAgain` handler in socketServer.ts**

After the `game:nextRound` handler block (around line 999), add:

```ts
    // ── game:playAgain ─────────────────────────────────────────────────────
    // Host-only. Allowed from game_end phase. Keeps room + playerTotals.
    // Resets team totals (fresh game) but playerTotals carry forward.
    // Note: startNewRound() already does `newGameState.playerTotals = prev.playerTotals`
    // so per-player scores are preserved automatically.
    socket.on('game:playAgain', (payload: { roomId: string }) => {
      const info = socketToPlayer.get(socket.id);
      if (!info || info.roomId !== payload.roomId) return;

      const room = rooms.get(payload.roomId);
      if (!room) return;

      if (info.playerId !== room.hostId) {
        socket.emit('room:error', { message: 'Only the host can start a new game' });
        return;
      }
      if (!room.gameState || room.gameState.phase !== 'game_end') {
        socket.emit('room:error', { message: 'Game has not ended yet' });
        return;
      }

      // Reset team totals so new game starts teams from 0
      // (per-player totals carry forward via startNewRound's existing logic)
      roomTeamTotals.set(payload.roomId, { A: 0, B: 0 });

      startNewRound(io, payload.roomId);
    });
```

- [ ] **Step 2: Add `playAgain` emit in socketClient.ts**

After the `startNextRound` emit, add:
```ts
  playAgain: (roomId: string) =>
    getSocket().emit('game:playAgain', { roomId }),
```

- [ ] **Step 3: Fix `onPlayAgain` in `app/game/[roomId]/page.tsx`**

Replace:
```tsx
          onPlayAgain={() => router.push('/lobby')}
```
with:
```tsx
          onPlayAgain={() => {
            if (isHost && roomId) socketEmit.playAgain(roomId);
          }}
```

Pass `isHost` to `WinnerScreen`. `WinnerScreen` already receives `onPlayAgain` as a prop, so the host check is in the page handler. Non-host players will see a greyed-out or hidden Play Again button. Update WinnerScreen to disable "Play Again" when `!isHost`:

Add an `isHost` prop to `WinnerScreenProps`:
```ts
interface WinnerScreenProps {
  // ... existing props ...
  isHost: boolean;
}
```

Update the "Play Again" button in `WinnerScreen.tsx`:
```tsx
          <button
            onClick={onPlayAgain}
            disabled={!isHost}
            className={clsx(
              'flex-1 font-bold rounded-xl py-3 text-sm shadow-lg transition-all',
              isHost
                ? 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white shadow-green-900/40'
                : 'bg-slate-700/50 text-slate-500 cursor-not-allowed'
            )}
          >
            {isHost ? '🎮 Play Again' : '⏳ Waiting for host...'}
          </button>
```

Pass `isHost` from the game page:
```tsx
        <WinnerScreen
          // ... existing props ...
          isHost={isHost}
        />
```

- [ ] **Step 4: Check TypeScript**

Run: `npx tsc --noEmit 2>&1 | head -60`

- [ ] **Step 5: Commit**

```bash
git add lib/socket/socketServer.ts lib/socket/socketClient.ts components/game/WinnerScreen.tsx app/game/[roomId]/page.tsx
git commit -m "fix: Play Again keeps room and scores, restarts round in-place; non-host sees waiting state

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 7: Winner Dialog Scroll Fix

**Files:**
- Modify: `components/game/WinnerScreen.tsx`

- [ ] **Step 1: Add scroll to outer container**

In `WinnerScreen.tsx`, the outer `div` currently has `className="fixed inset-0 z-50 ... flex flex-col items-center justify-center overflow-hidden"`.

Replace `overflow-hidden` with `overflow-y-auto` and add `max-h-screen`:
```tsx
    <div className="fixed inset-0 z-50 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex flex-col items-center justify-center overflow-y-auto">
```

And on the inner content wrapper, add `my-auto` to keep it centered but allow scrolling on small screens:
```tsx
      <div className="relative z-10 flex flex-col items-center text-center px-6 max-w-2xl w-full my-8">
```

- [ ] **Step 2: Commit**

```bash
git add components/game/WinnerScreen.tsx
git commit -m "fix: WinnerScreen dialog scrollable on small screens / large player counts

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 8: Fix remaining TypeScript errors from deckColor migration

After all above tasks, run a final TypeScript check and fix any remaining errors from the `deckColor` field being required on `Card`.

- [ ] **Step 1: Find all remaining type errors**

Run: `npx tsc --noEmit 2>&1`

Common locations that may need `deckColor: 'red'` added:
- Any place that constructs a `Card` object inline (e.g. mock/fallback cards)
- `PartnerSelector.tsx` — the `makeAllCards()` helper creates cards without `deckColor`
- Any test files or fixtures

- [ ] **Step 2: Fix each error**

For any inline Card construction missing `deckColor`, add `deckColor: 'red' as const`.

Example fix in `PartnerSelector.tsx`:
```ts
function makeAllCards(): CardType[] {
  return ALL_SUITS.flatMap((suit) =>
    ALL_RANKS.map((rank) => ({
      id: `${suit}_${rank}`,
      suit,
      rank,
      points: CARD_POINTS[rank],
      deckColor: 'red' as const,
    }))
  );
}
```

- [ ] **Step 3: Final TypeScript clean check**

Run: `npx tsc --noEmit 2>&1`

Expected: zero errors.

- [ ] **Step 4: Build check**

Run: `npm run build 2>&1 | tail -20`

Expected: build succeeds with no errors.

- [ ] **Step 5: Push all commits**

```bash
git push origin main
```

---

## Post-Implementation

After all tasks are merged and deployed:

1. **Update `GAME_RULES.md`** to reflect:
   - 3♠ is rank-3, no special power
   - Partner selection by card type (not deckColor-specific)
   - Last duplicate wins in double-deck tricks
   - Seat positions are absolute (everyone sees same layout)

2. **Smoke test on deployed instance** (https://3ofspades-production.up.railway.app/):
   - Start an 8p2d game, check card IDs in browser network tab
   - Verify 3♠ does not auto-win tricks
   - Verify Play Again from winner screen stays in room
   - Verify 10-player game shows all seats in correct absolute positions
