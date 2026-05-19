# 3♠ Spades — Flutter Mobile App Design Spec
**Date:** 2026-05-19  
**Scope:** Android + iOS mobile app using Flutter, connecting to the existing Socket.IO server

---

## 1. Problem Statement

The existing 3♠ Spades game is a web app (Next.js 16 + Socket.IO). The goal is to publish it on the **Google Play Store and Apple App Store** as a proper native-feeling mobile app. The user wants Flutter as the framework, a partial rewrite (redo UI, keep server/game-engine), and both Android + iOS from a single codebase.

---

## 2. Approach: Flutter Client + Existing Server

The Socket.IO server (`server.ts`) is **unchanged**. It already manages all game logic, room creation, bot players, bidding, trick evaluation, and scoring. Web players and Flutter mobile players share the same game rooms simultaneously via the same socket events.

```
┌──────────────────────────────────────────────┐
│     Node.js Socket.IO Server (unchanged)     │
│  (game-engine, room logic, bots, scoring)    │
└──────────┬───────────────────┬───────────────┘
           │  same events      │  same events
    ┌──────▼──────┐      ┌─────▼──────────────┐
    │  Next.js    │      │  Flutter Mobile    │
    │  Web Client │      │  Android + iOS     │
    └─────────────┘      └────────────────────┘
```

The Flutter app is a new **display client only** — it receives game state and renders it. No game logic lives in Dart.

---

## 3. Flutter Project Structure

```
3ofspades_flutter/           ← new sibling repo or sub-directory
├── lib/
│   ├── main.dart            ← app entry, ProviderScope, GoRouter
│   ├── models/
│   │   ├── card.dart        ← Card(suit, rank, id)
│   │   ├── player.dart      ← Player(id, name, team, isBot, isReady)
│   │   ├── game_state.dart  ← full GameState shape mirroring TS types
│   │   ├── room.dart        ← Room(id, name, players, phase)
│   │   └── bid_state.dart   ← BidState(currentBid, minBid, currentBidderId, passed)
│   ├── services/
│   │   └── socket_service.dart  ← singleton socket_io_client wrapper
│   ├── providers/
│   │   ├── player_provider.dart  ← playerId, playerName, roomId (persisted)
│   │   ├── room_provider.dart    ← currentRoom, isConnected, error
│   │   └── game_provider.dart    ← gameState, myHand, derived selectors
│   ├── screens/
│   │   ├── home_screen.dart      ← logo + Create/Join buttons
│   │   ├── lobby_screen.dart     ← name input, create room, join room
│   │   ├── room_screen.dart      ← waiting room, player list, Ready toggle
│   │   └── game_screen.dart      ← full-screen game table
│   ├── widgets/
│   │   ├── game_table.dart       ← layout orchestrator
│   │   ├── player_seat.dart      ← avatar circle, name, turn ring, bid chip
│   │   ├── card_hand.dart        ← fan of cards, tap to select, tap to play
│   │   ├── bid_panel.dart        ← bid amount selector + Pass/Bid buttons
│   │   ├── trump_selector.dart   ← suit selection overlay
│   │   ├── partner_selector.dart ← card picker overlay with suit tabs
│   │   ├── trick_pile.dart       ← 6 cards in the center
│   │   └── scoreboard.dart       ← round scores modal
│   └── painters/
│       ├── card_painter.dart     ← CustomPainter for playing cards
│       └── table_painter.dart    ← green felt gradient + gold border rail
├── pubspec.yaml
├── android/
└── ios/
```

---

## 4. Data Models (Dart)

All models are direct translations of the TypeScript types in `types/`. They implement `fromJson` factory constructors for Socket.IO payloads.

```dart
// models/card.dart
class CardModel {
  final String id;
  final String suit;   // 'spades' | 'hearts' | 'diamonds' | 'clubs'
  final String rank;   // '2'–'10' | 'J' | 'Q' | 'K' | 'A' | '3'
  CardModel.fromJson(Map<String, dynamic> j)
    : id = j['id'], suit = j['suit'], rank = j['rank'];
}
```

All 5 model files follow this same pattern. No game logic in models.

---

## 5. Socket Service

`SocketService` is a singleton that wraps `socket_io_client`. It mirrors the `socketEmit.*` helper pattern from `lib/socket/socketClient.ts`.

**Connection:** The server URL is configurable (dev: `ws://localhost:3000`, prod: the deployed Railway URL).

**Events emitted (client → server):**
- `room:create`, `room:join`, `room:addBot`
- `player:ready`, `game:start`
- `game:placeBid`, `game:selectTrump`, `game:selectPartners`, `game:playCard`
- `blackout:reveal` (ESC/space blackout feature)

**Events received (server → client):**
- `room:created`, `room:joined`, `room:updated`
- `game:started`, `player:hand`
- `game:cardPlayed`, `game:trickComplete`, `game:roundEnd`, `game:end`

All 15+ events from the README map 1:1 — no server changes needed.

---

## 6. State Management (Riverpod)

| Zustand Store (web) | Riverpod Provider (Flutter) | Persistence |
|---------------------|----------------------------|-------------|
| `playerStore.ts` | `playerProvider` (StateNotifier) | `shared_preferences` |
| `lobbyStore.ts` | `roomProvider` (StateNotifier) | in-memory |
| `gameStore.ts` | `gameProvider` (StateNotifier) | in-memory |

`gameProvider` exposes derived selectors mirroring `useGame.ts`:
- `myPlayerId`, `myHand`, `isMyTurn`, `playableCardIds`
- `currentTrick`, `completedTricks`, `phase`
- `bidState`, `trumpSuit`, `teams`, `calledCards`

Socket events arrive in `SocketService`, which calls `ref.read(gameProvider.notifier).updateFromEvent(event, data)`.

---

## 7. UI Screens

### Home Screen
- Centered logo: `3 ♠ SPADES` with animated gold gradient sweep (shimmer)  
- Two buttons: **Create Room** / **Join Room**
- Dark background matching web (`#020802`)

### Lobby Screen
- Text fields: Player Name, Room Code (join only)
- Create Room → `room:create` emit → navigate to Room screen
- Join Room → `room:join` emit → navigate to Room screen

### Room Screen
- Player list (name, ready status, bot indicator)
- **Ready** toggle button
- Host only: **Add Bot**, **Start Game** buttons
- Room code displayed prominently for sharing

### Game Screen
- Full-screen game table using `GameTable` widget
- Overlay widgets for `BidPanel`, `TrumpSelector`, `PartnerSelector`
- Blackout overlay (equivalent to `BlackoutOverlay.tsx`) — long-press or device shake to toggle

---

## 8. Game Table Layout

The game table matches the approved rectangular HTML mockup exactly.

### Portrait (phones held upright)
```
┌─────────────────────────┐
│  [P3 top-left] [P4 top] [P5 top-right]  │  ← opponent seats
│                         │
│      GREEN FELT         │
│   [Trick pile center]   │
│                         │
│  [P1 left]   [P2 right] │  ← side opponents
│  ─────────────────────  │
│      MY CARD HAND       │  ← bottom zone
│  [pts] [sort] [hide]    │
└─────────────────────────┘
```

### Landscape (phones held sideways)
```
┌────┬────────────────────────┐
│    │  [P3]    [P4]   [P5]  │
│HUD │      GREEN FELT        │
│    │   [Trick pile]         │
│100 │  [P1]          [P2]   │
│px  ├────────────────────────┤
│    │     MY CARD HAND       │
└────┴────────────────────────┘
```
Left 100px sidebar contains: Round, Team A pts, Team B pts, Target, Trick count.

### Seat Positions
6 player seats placed at percentage positions matching the web implementation:
- Local player: `(50%, 92%)`
- Left-mid: `(10%, 50%)`
- Top-left: `(22%, 18%)`
- Top-center: `(50%, 14%)`
- Top-right: `(78%, 18%)`
- Right-mid: `(90%, 50%)`

In landscape, all positions shift right by 100px / screenWidth percentage to account for sidebar.

---

## 9. Card Rendering (CustomPainter)

Cards are drawn entirely with `Canvas` — no image assets needed.

```dart
class CardPainter extends CustomPainter {
  // Card body: white RRect with rounded corners
  // Suit colour: red for ♥♦, near-black for ♠♣
  // Rank text: top-left corner + bottom-right (rotated 180°)
  // Suit symbol: center, large
  // Face-down: dark green diagonal pattern (#1c5c2e) matching table felt
  // 3♠ special: animated gold gradient sweep using AnimationController
}
```

Card dimensions follow the same aspect ratio as the web (roughly 2.5:3.5, i.e., standard poker size).

---

## 10. Animations

| Animation | Implementation |
|-----------|----------------|
| Card deal fly-in | `flutter_animate` with offset + scale |
| Card play (fly to center) | `AnimatedPositioned` or `Hero` widget |
| Shimmer on 3♠ logo | `AnimationController` → gradient sweep |
| Trump chip pulse | `AnimationController` → box shadow glow |
| Turn indicator ring | `AnimatedContainer` border pulse |
| Trick pile collect | Cards animate to winner's seat |

---

## 11. Key Dependencies

```yaml
dependencies:
  flutter_riverpod: ^2.5.1     # state management
  socket_io_client: ^2.0.3+1   # Socket.IO connection
  go_router: ^14.2.0           # navigation
  shared_preferences: ^2.3.1   # persist playerId/name
  flutter_animate: ^4.5.0      # deal + play card animations
  animated_text_kit: ^4.2.2    # logo shimmer text

dev_dependencies:
  flutter_test:
    sdk: flutter
  flutter_lints: ^4.0.0
```

---

## 12. What Is NOT Ported

| Web-only concept | Flutter equivalent |
|------------------|--------------------|
| Tailwind CSS classes | `BoxDecoration`, `TextStyle` in Dart |
| Framer Motion | `flutter_animate` + `AnimationController` |
| Zustand | Riverpod `StateNotifier` |
| Next.js routing | `go_router` |
| localStorage | `shared_preferences` |
| Socket.IO server | **unchanged** — same Node.js server |
| Game engine logic | **unchanged** — stays on server |

The TypeScript game engine in `lib/game-engine/` is **not ported to Dart**. All game logic runs server-side; the Flutter app only renders state it receives.

---

## 13. Deployment

- **Android:** `flutter build apk --release` or `flutter build appbundle` for Play Store
- **iOS:** `flutter build ipa --release` for App Store (requires macOS + Xcode)
- **Server:** Existing Railway deployment unchanged; update CORS to allow mobile origins (already websocket-based, no CORS issue)

---

## 14. Out of Scope (First Version)

- Push notifications
- In-app purchases
- Offline / bot-only mode
- In-app server address configuration (use hardcoded prod URL)
- iPad-specific layout (phone layout scales fine)
