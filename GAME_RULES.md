# 3 of Spades — Complete Game Rules & Logic Reference

> This document is auto-derived from the live codebase. Every rule, formula, and flow described here matches exactly what the game engine enforces.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Game Modes (Presets)](#2-game-modes-presets)
3. [The Deck & Card Values](#3-the-deck--card-values)
4. [Room & Lobby](#4-room--lobby)
5. [Phase Flow](#5-phase-flow)
6. [Phase 1 — Dealing](#6-phase-1--dealing)
7. [Phase 2 — Bidding](#7-phase-2--bidding)
8. [Phase 3 — Trump Selection](#8-phase-3--trump-selection)
9. [Phase 4 — Partner Selection](#9-phase-4--partner-selection)
10. [Phase 5 — Playing](#10-phase-5--playing)
11. [Trick Resolution Rules](#11-trick-resolution-rules)
12. [Partner Reveal Mechanic](#12-partner-reveal-mechanic)
13. [Scoring](#13-scoring)
14. [Per-Player Cumulative Scoring](#14-per-player-cumulative-scoring)
15. [Game End Condition](#15-game-end-condition)
16. [Turn Timer & Auto-Play](#16-turn-timer--auto-play)
17. [Disconnect & Reconnect](#17-disconnect--reconnect)
18. [Host Powers](#18-host-powers)
19. [Bot Behaviour](#19-bot-behaviour)
20. [Glossary](#20-glossary)

---

## 1. Overview

**3 of Spades** is a trick-taking card game for 4–10 players. One player wins the auction (the "bid winner"), secretly names partner cards, and tries to win enough tricks with their hidden team to meet their bid. Partners are revealed gradually during play when they play the card their ally called.

---

## 2. Game Modes (Presets)

Five presets are available, chosen when the room is created:

| Preset | Players | Decks | Cards/Player | Tricks | Min Bid | Partners | Total Round Points |
|--------|---------|-------|-------------|--------|---------|----------|-------------------|
| `4p1d` | 4 | 1 | 12 | 12 | 150 | 1 | 250 |
| `6p1d` *(default)* | 6 | 1 | 8 | 8 | 130 | 2 | 250 |
| `6p2d` | 6 | 2 | 16 | 16 | 260 | 2 | 500 |
| `8p2d` | 8 | 2 | 12 | 12 | 200 | 3 | 500 |
| `10p2d` | 10 | 2 | 9 | 9 | 250 | 4 | 500 |

> **Note:** The 10-player double-deck has 96 cards but only 90 are dealt (9 × 10), so 6 cards are burned from the deck.

---

## 3. The Deck & Card Values

### Suits (4)
`♠ Spades` · `♥ Hearts` · `♦ Diamonds` · `♣ Clubs`

### Ranks (12 per suit, low → high)
`3 – 4 – 5 – 6 – 7 – 8 – 9 – 10 – J – Q – K – A`

### Card Point Values
Only specific cards carry points; all others are worth **0**:

| Card | Points |
|------|--------|
| **3 of Spades** | **30** — the supreme card |
| A (any suit) | 10 |
| K (any suit) | 10 |
| Q (any suit) | 10 |
| J (any suit) | 10 |
| 10 (any suit) | 10 |
| 5 (any suit) | 5 |
| All others (3–9 except 3♠, 4–9 non-5) | 0 |

> **Single deck total:** 4×(A+K+Q+J+10=50) + 4×(5=5×4=20) + 30 = 250 points  
> **Double deck total:** 500 points

---

## 4. Room & Lobby

### Creating a Room
- The creator becomes the **Host** (👑) and occupies Seat 0.
- The host picks a preset, turn timer, max rounds, and target score.
- Default: `6p1d`, 60-second turn timer, unlimited rounds, 500-point target.

### Joining
- Players join via room code or share link.
- Maximum players = `preset.playerCount`.
- Seats are assigned in join order.

### Readying Up
- All non-host humans must press **"Mark as Ready"** before the game can start.
- The host does not need to mark ready.
- The host can add AI bots to fill empty seats (up to `maxPlayers − 1` bots).

### Kick Player *(host only)*
- In the lobby, the host can remove any non-host player.
- Kicked players are redirected to the home page with a notification.

### Host Leaves
- If the host disconnects while in the **lobby** (no game running), the room is **immediately deleted** and all remaining players are redirected home.
- If the host disconnects **during a game**, the game continues; auto-play handles their turns.

---

## 5. Phase Flow

```
lobby
  ↓  [host presses Start]
dealing
  ↓  [deal animation completes / host skips]
bidding
  ↓  [one player wins the auction]
trump_selection
  ↓  [bid winner picks trump suit]
partner_selection
  ↓  [bid winner selects partner cards]
playing
  ↓  [all tricks completed]
round_end
  ↓  [host starts next round]  OR  [winning score reached]
dealing  ← loop             game_end
```

---

## 6. Phase 1 — Dealing

1. A shuffled deck is dealt **round-robin** to all players in seat order.
2. Each player receives exactly `cardsPerPlayer` cards.
3. The deal animation plays on-screen (one "round" per card-per-player, all players receive a card simultaneously each round — max 9 animation rounds).
4. The **Dealer** rotates each round (dealerIndex increments by 1 mod playerCount).
5. After the animation, the phase automatically advances to **Bidding**.

---

## 7. Phase 2 — Bidding

### Turn Order
- Bidding starts with the player **immediately to the left of the dealer** (by seatIndex, wrapping around).
- Turn advances clockwise (next seatIndex).

### Valid Bid
A bid is legal if:
- Amount ≥ `minBid` (preset-specific, see §2).
- Amount is a **multiple of 10** (`bidIncrement = 10`).
- Amount > current highest bid in this round.
- Or the player chooses to **Pass**.

### Passing
- A player who passes is eliminated from further bidding that round.
- Once a player passes, their turn is skipped for the rest of bidding.

### Winning the Bid
The bid is won when **only one non-passed player remains with a numeric bid**. That player becomes the **Bid Winner** for this round.

### All-Pass Edge Case
If every player passes without placing a numeric bid, the **dealer is forced to bid the minimum** (`minBid`). The server sets `allPassed = true` and the dealer must bid.

### Edge Case — Pass After Bidding
If a player bid earlier but later passes (another player outbid them and they decline to counter), the highest bidder at that moment wins.

---

## 8. Phase 3 — Trump Selection

- Only the **Bid Winner** acts.
- They choose one of the four suits: ♠ ♥ ♦ ♣.
- That suit becomes the **trump suit** for the entire round.
- Trump cards beat all non-trump cards in tricks (see §11).

---

## 9. Phase 4 — Partner Selection

### What It Is
The Bid Winner secretly selects **`partnerCount` cards** from the full deck. Whoever holds those cards in their hand is their partner for this round — but nobody (including the partner) knows who it is until the card is played.

### How Partners Are Selected
- The Bid Winner picks exactly `partnerCount` card type IDs (e.g. `hearts_K`, `diamonds_A`).
- Card IDs are canonical `{suit}_{rank}` type IDs, which work in both single- and double-deck games.
- The server looks through **all hands** to find which player holds a matching card. That player becomes a partner. The Bid Winner cannot select a card from their own hand as a partner card.

### Team Formation
```
Team A (Bidding Team): Bid Winner + all partners
Team B (Defending Team): all remaining players
```

Teams are secret at this stage — players in Team B do not know who is in Team A besides the Bid Winner.

### Partner Count by Preset
| Preset | Partners | Team A Size | Team B Size |
|--------|----------|-------------|-------------|
| 4p1d | 1 | 2 | 2 |
| 6p1d | 2 | 3 | 3 |
| 6p2d | 2 | 3 | 3 |
| 8p2d | 3 | 4 | 4 |
| 10p2d | 4 | 5 | 5 |

### First Lead
The **Bid Winner** leads the first trick after partner selection is complete.

---

## 10. Phase 5 — Playing

### Turn Order During Tricks
- Each player plays **one card** per trick in seat order, starting from the trick leader.
- After a trick completes, the **winner of that trick leads the next one**.

### Follow-Suit Rule (Mandatory)
- If the trick has a **lead suit** established and the player holds **any card** of that suit, they **must play a card of that suit**.
- If the player has no card of the lead suit, they may play **any card** (including trump).

### Playing the 3 of Spades
The 3♠ is the supreme card. It can be played at any time (including when you have the lead suit), and it **always wins** the trick regardless of trump or rank.

---

## 11. Trick Resolution Rules

Priority order (highest to lowest):

1. **3 of Spades (3♠)** — supreme card, always wins. If two 3♠ exist (double deck), the first one played wins.
2. **Trump card** — beats any non-trump card.
   - If multiple trump cards are played, the **highest rank** among them wins.
3. **Lead-suit card** — beats non-trump, non-lead-suit cards.
   - If multiple lead-suit cards are played (no trump), the **highest rank** wins.
4. **Off-suit non-trump** — cannot beat any trump or lead-suit card. Among themselves, the challenger cannot beat the current leader (first played wins ties by position).

### Rank Order (low → high)
```
3 < 4 < 5 < 6 < 7 < 8 < 9 < 10 < J < Q < K < A
```

> ⚠️ The **3 of Spades is the lowest-ranked card** in normal rank comparison (rank `3`), BUT it has a special override rule that makes it the strongest card in trick resolution.

---

## 12. Partner Reveal Mechanic

### How Partners Are Revealed
- Partners are **secret until they play their called card**.
- When a player plays a card that matches one of the Bid Winner's called cards, they are immediately **revealed as a partner** to all players.
- The `revealedPartnerIds` array grows one entry at a time as partners reveal themselves.

### What "Calling a Card" Means
- In single-deck games: card ID is `suit_rank` (e.g. `spades_K`).
- In double-deck games: both copies of the called card (`suit_rank_0` and `suit_rank_1`) trigger a reveal.

### UI Behaviour
- The Scoreboard shows partner identities only after they are revealed.
- Unrevealed partners show as "+N hidden partners" in the team panel.

---

## 13. Scoring

### Per-Round Scoring

At the end of all tricks, scores are calculated as follows:

#### ✅ Bid Made (`Team A's roundPoints ≥ bidAmount`)
| Team | Change |
|------|--------|
| **Team A** (bidding) | `+ roundPoints` (points they collected from tricks) |
| **Team B** (defending) | `+ roundPoints` (points they collected from tricks) |

#### ❌ Bid Failed (`Team A's roundPoints < bidAmount`)
| Team | Change |
|------|--------|
| **Team A** (bidding) | `− bidAmount` (the full bid amount is subtracted as penalty) |
| **Team B** (defending) | `+ roundPoints + bidAmount` (their tricks + the bid penalty bonus) |

### Round Points Formula
```
Each team's roundPoints = sum of point values of all cards
                         in tricks won by that team's players
```

### Example
> 6-player game. Team A bid 160. After all tricks:  
> Team A collected 180 round points → **Bid Made**  
> Team A total += 180  
> Team B total += 70 (their round points)
>
> Next round: Team A bid 150 but only collected 120 → **Bid Failed**  
> Team A total -= 150  
> Team B total += 80 + 150 = 230

---

## 14. Per-Player Cumulative Scoring

Each player accumulates a **personal score** across rounds. The score is derived from their team's result each round.

### Formula per round
```
If bid MADE:
  onBidTeam  → +teamA_roundPoints  (same for all Team A members)
  onOtherTeam → +teamB_roundPoints (same for all Team B members)

If bid FAILED:
  onBidTeam  → −bidAmount
  onOtherTeam → +(teamB_roundPoints + bidAmount)
```

Since teams change every round, a player's cumulative score reflects their personal wins and losses regardless of who their partners were.

### Example (3 rounds)
| Round | Player 1 (Team A, bid made 250) | Player 2 (Team B) | Player 3 (Team A, bid failed 150) |
|-------|--------------------------------|-------------------|-----------------------------------|
| Round 1 | +250 | +0 → Total: 0 | +250 |
| Round 2 | P1 on Team B, +70 | P2 on Team A, bid made +180 | P3 on Team B, +70 |
| Round 3 | P1 on Team A, bid failed −150 | P2 on Team B, +80+150=230 | P3 on Team B, +230 |

---

## 15. Game End Condition

### Victory Condition
The game ends after a round when **either Team A or Team B's `totalPoints` ≥ `targetScore`** (default: 500).

> Note: `targetScore` (room config) is the threshold for `winnerTeamId`. If both teams cross it in the same round, Team A wins. `checkGameWinner` checks Team A first.

### Max Rounds
If `maxRounds > 0`, the game also ends after that many rounds. The team with the higher total wins.

### Vote to End
Any player can vote to terminate the game early. Once **all players** have voted, the game is terminated immediately.

### Host Terminate
The host can forcibly end the game at any point during `playing` or `round_end` phases.

### Winner Screen
At game end, players are shown a personal leaderboard sorted by cumulative score with 🥇🥈🥉 medals.

---

## 16. Turn Timer & Auto-Play

- Default turn timer: **60 seconds** (configurable per room, 0 = disabled).
- A countdown is shown to all players while someone's turn is active.
- When the timer expires, the server **auto-plays** for that player:
  - **Bidding:** auto-pass.
  - **Trump selection:** auto-selects spades.
  - **Partner selection:** auto-picks `partnerCount` random valid cards.
  - **Playing:** plays the first legal card in the player's hand.

Auto-play also fires **immediately** (bypassing the timer) if the current player is **disconnected**.

---

## 17. Disconnect & Reconnect

### On Disconnect
1. Player status is set to `'disconnected'`.
2. All other players see the status change.
3. If it was that player's turn, auto-play fires immediately.
4. A **60-second reconnect window** starts.

### On Reconnect
- Player re-joins with their existing `playerId`.
- Server sends full `game:stateSync` and their current hand.
- Their status is restored to `'playing'`.

### After 60 Seconds (No Reconnect)
- **During a game:** Player is removed; their hand is deleted; other players continue.
- **In lobby (non-host):** Player is removed from the room.
- **In lobby (host):** Room is **deleted** and all remaining players are sent home.

---

## 18. Host Powers

The host (👑) has exclusive abilities:

| Action | When |
|--------|------|
| Add Bot | Lobby only |
| Kick Player | Lobby only, non-host players |
| Start Game | Lobby, all players ready |
| Skip Deal Animation | During `dealing` phase |
| Start Next Round | During `round_end` phase |
| Terminate Game | During `playing` or `round_end` |

---

## 19. Bot Behaviour

Bots act automatically with a `1200ms` delay to simulate thinking:

| Phase | Bot Action |
|-------|------------|
| Bidding | Places a random valid bid or passes (heuristic based on hand strength) |
| Trump Selection | Picks the suit they hold the most of (highest-count suit in hand) |
| Partner Selection | Picks `partnerCount` random cards not in their own hand |
| Playing | Plays the first legal card in hand (lowest ranked valid card) |

Bots are always marked `status: 'ready'` and count toward the player count.

---

## 20. Glossary

| Term | Meaning |
|------|---------|
| **Bid Winner** | The player who won the auction for this round |
| **Called Cards** | The cards selected by the Bid Winner to identify partners |
| **Partner** | A player who holds a called card; on Team A with the Bid Winner |
| **Trump Suit** | The suit that beats all other suits in tricks |
| **Lead Suit** | The suit of the first card played in a trick |
| **Trick** | One round of card play where each player plays one card |
| **Round Points** | Sum of point values of all cards in tricks won by a team |
| **Bid Made** | When the bidding team's round points ≥ their bid amount |
| **Bid Failed** | When the bidding team's round points < their bid amount |
| **3♠** | 3 of Spades — the supreme card, always wins a trick |
| **Team A** | The bidding team (Bid Winner + partners) |
| **Team B** | The defending team (all other players) |
| **Dealer** | Rotates each round; bidding starts left of the dealer |
| **seatIndex** | Fixed 0-based seat number assigned at join time; defines turn order |
| **Host** | The player who created the room; has admin powers |
| **allPassed** | Special state when everyone passes without bidding; dealer forced to bid |
| **revealedPartnerIds** | Partners whose identity has been exposed by playing their called card |
