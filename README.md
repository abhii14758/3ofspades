# 3 of Spades — Kali Teeri / Kali Ni Tidi

A real-time multiplayer trick-taking card game built with Next.js 16, Socket.IO, and Zustand.

## Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

To play multiplayer on the same LAN, share your machine's local IP and room code with friends.

---

## How to Play (Multiplayer)

1. **Host** clicks **Create Room**, enters a name and room name.
2. Share the **6-character room code** with up to 5 friends on the same network.
3. Friends click **Join Room** and enter the code.
4. The host can add **bots** to fill empty seats.
5. All players click **Ready**. Once 6 players are ready, the host clicks **Start Game**.

---

## Game Rules

### Overview

3 of Spades is a 6-player trick-taking game played in teams of 3. Teams are **secret** — the bid winner names two partner cards; only the players holding those cards know the full team.

### Card Values

| Card | Points |
|------|--------|
| 3 of Spades | 30 |
| Ace | 11 |
| 10 | 10 |
| King | 4 |
| Queen | 3 |
| Jack | 2 |
| Others | 0 |

### Round Flow

1. **Deal** — 8 cards dealt to each of 6 players (48 cards; twos removed).
2. **Bidding** — Bid clockwise for the right to choose trump. Min bid: 100. May pass.
3. **Trump Selection** — Bid winner secretly chooses the trump suit.
4. **Partner Selection** — Bid winner selects 2 partner cards from the full deck.
5. **Play 8 Tricks** — Must follow suit if possible; trump beats all other suits.
6. **Scoring** — Bid team scores if they collect >= bid amount in points. Otherwise the opposing team scores. First team to reach the winning score wins.

### Special Rules

- Partner card holders are **secret until they play that card**.
- The **3 of Spades** (30 pts) is the highest-value card in the game.
- Twos (2♠ 2♥ 2♦ 2♣) are removed from the deck before play.

---

## Architecture

```
app/                        Next.js App Router pages
  page.tsx                  Home — initialises shared socket
  lobby/page.tsx            Create / Join room
  room/[roomId]/page.tsx    Waiting room
  game/[roomId]/page.tsx    Main game screen

components/
  cards/        Card, CardBack, CardHand
  game/         GameTable · BidPanel · TrumpSelector · PartnerSelector
                TrickPile · PlayerSeat · RoundResult · WinnerScreen
                TurnIndicator · Scoreboard
  lobby/        CreateRoom · JoinRoom · PlayerList
  ui/           Button · LoadingSpinner · Modal · PlayingCard

store/
  playerStore.ts    Persisted: playerId, playerName, roomId
  lobbyStore.ts     currentRoom, isConnected, error
  gameStore.ts      gameState, myHand, showRoundResult, showWinner

hooks/
  useSocket.ts      Registers all Socket.IO listeners (call ONCE at root)
  useGame.ts        Derived game state + action dispatchers

lib/
  socket/socketClient.ts    Singleton socket; connectSocket(), socketEmit.*
  game-engine/              Pure game logic (bid, deck, rules, score, tricks)
  utils/                    cardUtils, roomUtils
```

---

## Socket Events

| Direction | Event | Key Payload |
|-----------|-------|-------------|
| emit | room:create | roomName, playerName |
| emit | room:join | roomId, playerName |
| emit | room:addBot | roomId |
| emit | player:ready | roomId |
| emit | game:start | roomId |
| emit | game:placeBid | roomId, amount |
| emit | game:selectTrump | roomId, suit |
| emit | game:selectPartners | roomId, cardIds |
| emit | game:playCard | roomId, cardId |
| on | room:created/joined | room, playerId |
| on | room:updated | room |
| on | game:started | gameState |
| on | player:hand | cards |
| on | game:cardPlayed | playerId, card, trick |
| on | game:trickComplete | trick, winnerId, nextTurnPlayerId, teams |
| on | game:roundEnd | roundHistory, teams, winnerTeamId |
| on | game:end | winnerTeamId, teams, roundHistory |

---

## Configuration (config/gameConfig.ts)

| Key | Default | Description |
|-----|---------|-------------|
| playerCount | 6 | Players per game |
| cardsPerPlayer | 8 | Cards dealt per round |
| minBid | 100 | Minimum opening bid |
| bidIncrement | 10 | Minimum raise amount |
| partnerCount | 2 | Partner cards to select |
| winningScore | 500 | Points to win the game |
| trumpBeatsAll | true | Trump defeats all other suits |
| mustFollowSuit | true | Players must follow lead suit |
| turnTimerSeconds | 30 | Seconds per turn (0 = disabled) |
| botsEnabled | true | Allow bot players |
| botDelayMs | 1200 | Bot thinking delay in ms |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS v4 |
| Animations | Framer Motion 12 |
| Real-time | Socket.IO v4 |
| State | Zustand v5 |
| Toasts | react-hot-toast |
| IDs | uuid v14 |

---

## Development

```bash
npm run dev      # Development server
npm run build    # Production build
npm run lint     # ESLint
```
