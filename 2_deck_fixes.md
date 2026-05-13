# 3 of Spades / KaliTiri — Double Deck Logic Fix Specification

# Purpose

This document defines the required rule corrections and architecture changes for the 2-deck game modes of the 3 of Spades / KaliTiri implementation.

The current implementation has several logical flaws related to:

* duplicate cards
* partner selection
* trick winner determination
* 3♠ priority logic
* hidden partnership mechanics

This specification replaces the incorrect logic with the correct real-world gameplay rules.

---

# CORE DESIGN CHANGES

The following systems MUST be updated:

1. Deck identity system
2. Partner selection
3. Partner reveal logic
4. Trick winner logic
5. 3♠ handling
6. Card identity architecture
7. UI rendering for duplicate cards

---

# 1. DOUBLE DECK ARCHITECTURE

## Problem

In 2-deck modes, cards currently use only:

```ts
{
  suit: "spades",
  rank: "A"
}
```

This creates ambiguity because two identical cards exist.

---

# REQUIRED FIX

Each physical card MUST have a unique deck identity.

Use:

```ts
type Card = {
  id: string;
  suit: "spades" | "hearts" | "diamonds" | "clubs";
  rank: "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K" | "A";
  deckColor: "red" | "blue";
};
```

Examples:

```ts
{
  id: "red_spades_A",
  suit: "spades",
  rank: "A",
  deckColor: "red"
}
```

```ts
{
  id: "blue_spades_A",
  suit: "spades",
  rank: "A",
  deckColor: "blue"
}
```

---

# 2. PARTNER SELECTION LOGIC

# CURRENT ISSUE

Current system selects:

```txt
spades_K
```

This incorrectly maps to BOTH copies.

---

# NEW RULE

Partner selection MUST allow choosing:

* exact physical card copy
* using deck color identity

Examples:

* red_spades_K
* blue_spades_K

---

# IMPORTANT RULE

If bidder already owns one copy:

* bidder may still select the OTHER copy.

Example:

* bidder owns red_spades_K
* bidder can select blue_spades_K
* bidder CANNOT select red_spades_K

---

# UI REQUIREMENTS

Partner selection modal MUST show:

* two separate copies visually
* red deck card
* blue deck card

Example display:

```txt
[K♠ Red]
[K♠ Blue]
```

Disabled state:

* bidder-owned copy must be disabled
* selectable copy remains active

---

# VALIDATION RULE

Backend MUST validate:

```ts
selectedCard.ownerId !== bidWinnerId
```

for exact physical card.

NOT by rank+suit only.

---

# 3. PARTNER REVEAL LOGIC

# CURRENT ISSUE

Current system reveals ALL matching duplicate cards.

This is incorrect.

---

# NEW RULE

The FIRST player who throws the selected partner card becomes the partner.

After reveal:

* remaining duplicate copies behave as normal cards
* no additional partners created

---

# EXAMPLE

Bidder selected:

```txt
blue_spades_K
```

Scenario:

* Player B has blue_spades_K
* Player D has red_spades_K

If Player B throws blue_spades_K:

* Player B becomes partner

If Player D later throws red_spades_K:

* NO partner reveal
* normal gameplay only

---

# IMPORTANT

Only the EXACT selected physical card can reveal partner.

NOT rank+suit matching.

---

# 4. TRICK WINNER LOGIC

# CURRENT ISSUE

Current system:

* first duplicate wins

This is incorrect.

---

# NEW REAL GAME RULE

In duplicate card situations:

## The LAST played highest card wins.

---

# EXAMPLE

Lead:

```txt
Player 1 -> A♠
Player 2 -> K♠
Player 3 -> A♠
```

Winner:

```txt
Player 3
```

because:

* same rank
* same suit
* played later

---

# REQUIRED TRICK PRIORITY

Priority order:

1. Trump suit
2. Lead suit
3. Rank
4. If exact same rank+suit:
   -> LAST played wins

---

# IMPLEMENTATION RULE

Current comparison:

```ts
if (candidateRank > currentRank)
```

must become:

```ts
if (
  candidateRank > currentRank ||
  (
    candidateRank === currentRank &&
    candidateSuit === currentSuit
  )
)
```

because later duplicate overrides earlier duplicate.

---

# 5. REMOVE 3♠ SUPREME PRIORITY

# CURRENT ISSUE

Current implementation:

```txt
3♠ always wins
```

This is WRONG.

---

# REAL RULE

3♠ has:

* highest POINT VALUE
* NOT highest trick priority

---

# IMPORTANT

3♠ rank priority remains NORMAL.

Meaning:

```txt
4♠ beats 3♠
5♠ beats 4♠
A♠ beats K♠
```

Normal rank ordering applies.

---

# CORRECT RANK ORDER

```txt
3 < 4 < 5 < 6 < 7 < 8 < 9 < 10 < J < Q < K < A
```

NO SPECIAL OVERRIDE.

---

# REMOVE ALL SPECIAL LOGIC

Delete:

```ts
if (card.isThreeOfSpades) autoWin = true
```

Delete:

```ts
3♠ supreme logic
```

Delete:

```ts
3♠ override checks
```

---

# 6. 3♠ POINT LOGIC

3♠ still remains:

```txt
30 points
```

ONLY scoring changes.

NOT trick resolution.

---

# 7. UPDATED TRICK RESOLUTION

# FINAL PRIORITY RULE

## Case 1 — Trump exists

Highest trump wins.

If duplicate trump:

* latest played duplicate wins.

---

## Case 2 — No trump

Highest lead suit wins.

If duplicate lead suit:

* latest played duplicate wins.

---

## Case 3 — Off suit

Cannot win unless trump.

---

# 8. IMPORTANT EDGE CASES

# Edge Case 1

Two identical highest cards played.

Example:

```txt
A♠ then A♠
```

Result:

```txt
second A♠ wins
```

---

# Edge Case 2

Two identical trump cards played.

Example:

```txt
Trump = Hearts

K♥
K♥
```

Result:

```txt
second K♥ wins
```

---

# Edge Case 3

Partner card never played.

Result:

* partner remains hidden entire round

This is valid.

---

# Edge Case 4

Bidder accidentally owns both copies.

System MUST prevent selecting both.

---

# 9. BACKEND REQUIRED CHANGES

# Database / State

Update card model everywhere:

* game state
* hand state
* trick state
* partner state
* replay state

to include:

```ts
deckColor
```

---

# Partner Storage

Current:

```ts
partnerCards: ["spades_K"]
```

New:

```ts
partnerCards: ["blue_spades_K"]
```

---

# Trick Comparison Engine

Replace:

```ts
first played wins tie
```

with:

```ts
last played wins tie
```

---

# Remove All 3♠ Override Logic

Search and remove:

* supreme card
* auto win
* highest priority
* unbeatable logic

---

# 10. FRONTEND REQUIRED CHANGES

# Card Rendering

Duplicate cards must visually differ.

Use:

* red deck border
* blue deck border

or:

* red watermark
* blue watermark

---

# Partner Selection UI

Must display:

```txt
A♠ Red
A♠ Blue
```

separately.

---

# Trick Table UI

When duplicate cards appear:

* preserve play order visually

because latest duplicate wins.

---

# 11. GAME BALANCE BENEFITS

These changes fix:

* unfair partner inflation
* unpredictable team sizes
* duplicate ambiguity
* broken hidden partnership
* incorrect trick resolution
* broken 3♠ priority
* inconsistent duplicate handling

---

# 12. FINAL OFFICIAL RULES

## Double Deck

* Uses Red + Blue deck identities

## Partner Selection

* Select exact physical card

## Partner Reveal

* First played selected card reveals partner

## Duplicate Trick Logic

* Latest identical highest card wins

## 3♠

* Highest points only
* NOT highest priority

## Trick Ranking

```txt
Trump > Lead Suit > Rank
```

Duplicate tie:

```txt
latest played wins
```

---

# 13. CLAUDE IMPLEMENTATION TASKS

Claude must:

1. Refactor card schema
2. Add deckColor support
3. Update shuffling/dealing
4. Update partner selection UI
5. Update trick winner logic
6. Remove 3♠ special priority
7. Update backend validation
8. Update replay/history logic
9. Update websocket payloads
10. Update game documentation
11. Update bot logic
12. Add duplicate-card tests
13. Add partner reveal tests
14. Add trick resolution tests
15. Add migration compatibility for old games

---

# 14. REQUIRED TEST CASES

# Test 1

```txt
A♠ then A♠
```

Expected:

```txt
second wins
```

---

# Test 2

```txt
3♠ vs 4♠
```

Expected:

```txt
4♠ wins
```

---

# Test 3

```txt
red K♠ selected as partner
blue K♠ played
```

Expected:

```txt
NO reveal
```

---

# Test 4

```txt
selected partner card played
```

Expected:

```txt
partner revealed
```

---

# Test 5

```txt
duplicate trump cards
```

Expected:

```txt
latest duplicate wins
```

# ADDITIONAL IMPLEMENTATION TASKS

Add the following tasks to the existing implementation specification document.

---

# TASK 6 — FIX PLAYER POSITION SYNCHRONIZATION ACROSS ALL SCREENS

# CURRENT ISSUE

Currently player positions are rendered relative to the local user.

This causes:

* each player to see different seating layouts
* inconsistent gameplay orientation
* incorrect table synchronization
* confusion during multiplayer gameplay

Example:

* Player A sees Player B on left
* Player B sees Player A on left as well
* seat mapping becomes inconsistent

This is incorrect.

---

# REQUIRED BEHAVIOUR

ALL players MUST see:

* exact same table layout
* exact same player positions
* exact same seat ordering
* exact same orientation

The table must behave like a real physical card table.

---

# REQUIRED IMPLEMENTATION

Use:

```ts id="l9s2cf"
seatIndex
```

as the ONLY source of truth for positioning.

DO NOT rotate seats based on local player.

---

# FIXED POSITION MAPPING

Example for 4 players:

```txt id="7g8h0n"
Seat 0 -> Bottom
Seat 1 -> Left
Seat 2 -> Top
Seat 3 -> Right
```

Every client MUST render:

* same mapping
* same positions

---

# IMPORTANT

The current user ("You") should NOT rotate the table.

Instead:

* highlight the current user visually
* keep table globally synchronized

---

# REQUIRED FRONTEND CHANGES

Remove:

```ts id="n6dxi4"
relativeSeatCalculation()
```

Remove:

```ts id="nmpf4o"
rotateTableForCurrentUser()
```

Remove:

```ts id="c9dx8h"
localPlayerPerspectiveRendering()
```

---

# NEW RENDERING RULE

Render players ONLY by:

```ts id="9wyxgw"
seatIndex
```

---

# EXAMPLE LAYOUTS

## 4 Players

```txt id="nq6m0u"
Top    -> Seat 2
Left   -> Seat 1
Bottom -> Seat 0
Right  -> Seat 3
```

---

## 6 Players

```txt id="5zj1ci"
Bottom Center -> Seat 0
Bottom Left   -> Seat 1
Top Left      -> Seat 2
Top Center    -> Seat 3
Top Right     -> Seat 4
Bottom Right  -> Seat 5
```

---

## 8 Players

Use fixed elliptical positions.

---

# IMPORTANT UI RULE

All users must visually see:

* same gameplay state
* same player positions
* same trick direction
* same play order

---

# TEST CASE

Player A screenshot and Player B screenshot should show:

* same table orientation
* same seat positions
* same player mapping

Only difference:

```txt id="jcb75m"
"You"
```

label/highlight.

---

# TASK 7 — FIX WINNING GAME DIALOG SCROLLING

# CURRENT ISSUE

The game-end / winning dialog box is not scrollable.

This causes:

* leaderboard cutoff
* inaccessible buttons
* broken UI on smaller screens
* overflow issues on mobile/laptop

---

# REQUIRED FIX

The dialog MUST support:

* vertical scrolling
* responsive height
* overflow handling

---

# REQUIRED IMPLEMENTATION

Apply:

```css id="8pv3e0"
max-height: 90vh;
overflow-y: auto;
```

to:

* dialog body
* leaderboard container

---

# IMPORTANT

The following must remain visible:

* close button
* play another round button
* leaderboard
* scores

---

# MOBILE SUPPORT

On smaller screens:

* dialog should resize properly
* scrolling must work smoothly

---

# REQUIRED TESTS

Test:

* 10-player leaderboard
* mobile screen
* laptop screen
* browser zoom 125%+
* long score history

---

# TASK 8 — PERSIST SCORES BETWEEN ROUNDS

# CURRENT ISSUE

Currently:

* selecting "Play Another Round"
* restarts the game completely
* clears scores

This is incorrect.

---

# REQUIRED BEHAVIOUR

When:

```txt id="0v0m4p"
Play Another Round
```

is selected:

The game must:

1. preserve cumulative scores
2. preserve round history
3. reset gameplay state only
4. start a fresh round
5. rotate dealer
6. reshuffle cards
7. reset temporary round state

---

# PERSIST THESE VALUES

Keep:

```ts id="a8x5ek"
player.totalScore
player.gamesWon
roundHistory
dealerRotation
```

---

# RESET THESE VALUES

Reset:

```ts id="jlwm7j"
hands
tricks
bidWinner
partnerCards
revealedPartners
currentTrick
roundPoints
phase
turnState
```

---

# REQUIRED IMPLEMENTATION

Create:

```ts id="4n64z8"
startNextRound()
```

instead of:

```ts id="mhgk4s"
restartGame()
```

---

# IMPORTANT

The next round must behave like:

```txt id="dov9bp"
same match continuation
```

NOT:

```txt id="xg95jc"
new game lobby
```

---

# ROUND FLOW

Current:

```txt id="w68v9x"
Game End -> Restart Entire Game
```

NEW:

```txt id="q1l8mo"
Round End
 -> Persist Scores
 -> Increment Round Number
 -> Rotate Dealer
 -> Shuffle
 -> Deal
 -> Start New Round
```

---

# UI REQUIREMENTS

Display:

```txt id="sgm2kz"
Round 2
Round 3
Round 4
```

while cumulative scores continue.

---

# OPTIONAL IMPROVEMENT

Add:

```txt id="tw5h8f"
Match Summary
```

showing:

* cumulative scores
* rounds won
* bid success rate

---

# REQUIRED TESTS

# Test 1

Play another round:

```txt id="jlwm4q"
scores remain unchanged
```

---

# Test 2

Cards:

```txt id="q9jlwm"
must reshuffle
```

---

# Test 3

Dealer:

```txt id="jv5lmw"
must rotate
```

---

# Test 4

Round state:

```txt id="7wjlwm"
must reset fully
```

---

# Test 5

Game history:

```txt id="3jlwmc"
must persist
```
