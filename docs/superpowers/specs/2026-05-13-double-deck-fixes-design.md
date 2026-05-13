# Double-Deck Fixes Design

**Date:** 2026-05-13  
**Source:** `2_deck_fixes.md`  
**Status:** Approved

---

## Overview

Eight targeted fixes to support double-deck game modes (6p2d, 8p2d, 10p2d) correctly, plus two minor fixes that apply to all modes. The changes span card identity, partner logic, trick resolution, player positioning, score persistence, and UI.

---

## 1. Card Identity System (`deckColor`)

### What changes
- Add `deckColor: "red" | "blue"` as a **required** field on the `Card` type (`types/index.ts`)
- Single-deck games: all cards get `deckColor: "red"`
- Double-deck games: first deck = `"red"`, second deck = `"blue"`
- Card IDs change format:
  - Old: `spades_K_0`, `spades_K_1`
  - New: `red_spades_K`, `blue_spades_K`
- `getCardTypeId(card)` helper in `deck.ts` strips the `red_` / `blue_` prefix, returning `spades_K` — used for display and type-level comparisons

### Files affected
- `types/index.ts` — add `deckColor` field
- `lib/game-engine/deck.ts` — update `createDeck()` ID generation, update `getCardTypeId()`
- All downstream code that constructs or compares card IDs

---

## 2. Partner Selection & Reveal

### Selection logic (bid winner picks partner cards)
- Bidder selects partner cards by **card type** (rank + suit), NOT by specific `deckColor` copy
- UI shows card types; in double-deck each card type can be selected as **1 copy** or **both copies**
- **"Both copies" selection:** two different players who each play that card type become separate partners (only available in double-deck modes; single-deck always `count: 1`)
- **Bidder restriction:** bidder cannot select a card type where they personally hold ALL copies of it (since no opponent can play it to trigger the reveal)
- Backend stores partner card selections as `{ typeId: string, count: 1 | 2 }[]`

### Reveal logic
- When a card is played, check if its **type** (rank + suit via `getCardTypeId()`) matches any selected partner card
- The **first play** of that type triggers partner reveal for that slot
- If `count === 2`, the **second play** of that type also triggers a separate partner reveal
- **Edge case — one player holds both copies:** If a player holds both copies of a selected card type, only 1 partner is found from that slot. Team operates with one fewer partner (e.g. 8p game: bidder + 2 instead of bidder + 3)

### Files affected
- `lib/game-engine/roundEngine.ts` — `afterPartnersSelected()`, `processCardPlay()`
- `components/game/PartnerSelector.tsx` — UI shows type-based selection with 1/both toggle in double-deck
- `types/index.ts` — partner card type stores `{ typeId, count }`

---

## 3. Trick Engine Changes

### 3a. Remove 3♠ supreme priority (all modes)
- Delete the special override in `trickEngine.ts` (lines ~26-27) that makes 3♠ auto-win every trick
- 3♠ is now a regular **rank-3 card** — lowest rank, still worth 30 points, no special trick power
- Normal trump/lead/rank rules apply
- Applies to **all** game modes (single-deck and double-deck)

### 3b. Last duplicate wins (double-deck)
- When two cards of identical rank AND suit are played in the same trick, the **last played beats the first**
- Change in `cardBeats()`:
  - Old: challenger wins only if `candidateRank > currentRank`
  - New: challenger also wins if `candidateRank === currentRank AND candidateSuit === currentSuit`
- Harmless in single-deck (no duplicates exist); only activates in double-deck

### Files affected
- `lib/game-engine/trickEngine.ts` — `cardBeats()` function, remove 3♠ override

---

## 4. Player Seat Positioning

### Behaviour
- Seat avatars around the table use **absolute positions** mapped to `seatIndex`
- All players in the room see the **identical table layout** — no rotation based on local player identity
- The local player's **card hand stays fixed at the bottom** of the screen at all times (for usability)
- The local player's seat avatar is highlighted with a **"You" badge** at its absolute position

### Seat position maps

| seatIndex | 6-player       | 8-player       | 10-player      |
|-----------|----------------|----------------|----------------|
| 0         | Bottom-Center  | Bottom-Center  | Bottom-Center  |
| 1         | Bottom-Left    | Bottom-Left    | Bottom-Left    |
| 2         | Top-Left       | Mid-Left       | Mid-Left       |
| 3         | Top-Center     | Top-Left       | Far-Left       |
| 4         | Top-Right      | Top-Center     | Top-Left       |
| 5         | Bottom-Right   | Top-Right      | Top-Center     |
| 6         | —              | Mid-Right      | Top-Right      |
| 7         | —              | Bottom-Right   | Far-Right      |
| 8         | —              | —              | Mid-Right      |
| 9         | —              | —              | Bottom-Right   |

### Files affected
- `components/game/GameTable.tsx` — seat rendering loop uses seatIndex positions
- `components/game/PlayerSeat.tsx` — receives `seatIndex`, applies absolute position class

---

## 5. Play Again & Score Persistence

### Bug
Clicking "Play Again" on `WinnerScreen` redirects all players to the room creation page. Cumulative scores are lost.

### Fix
- "Play Again" button (host only) emits `room:playAgain` socket event
- Server resets **round state only** — room, players, and cumulative per-player scores are preserved
- New round scores are **added** to existing cumulative totals
- Non-host players see a "Waiting for host to restart..." message while host decides
- Scores reset only when the **room is destroyed** (host leaves or all players disconnect)
- `WinnerScreen.tsx` gets `max-height: 90vh; overflow-y: auto` so the leaderboard scrolls on large player counts

### Files affected
- `lib/socket/socketServer.ts` — add `room:playAgain` handler
- `lib/socket/socketClient.ts` — add `playAgain` emit
- `app/room/[roomId]/page.tsx` — handle `room:playAgain` event, show waiting state
- `components/game/WinnerScreen.tsx` — scroll fix + "Play Again" emits socket event instead of redirecting

---

## Implementation Order

1. **Card type + deck.ts** — foundation, must land first
2. **Trick engine** — remove 3♠ supreme, last-duplicate-wins (no dependency on deckColor)
3. **Partner selection & reveal** — type-based logic + UI
4. **Player seat positioning** — GameTable + PlayerSeat absolute layout
5. **Play Again / score persistence** — server + client
6. **Winner dialog scroll** — CSS-only, can land anytime

---

## Out of Scope

- No changes to bot behaviour beyond what's required by the above logic changes
- No changes to scoring formula or point values
- No changes to bidding rules
