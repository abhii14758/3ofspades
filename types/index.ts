export type GamePreset = '4p1d' | '6p1d' | '6p2d' | '8p2d' | '10p2d';

export type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs';
export type Rank = '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';
export type PlayerType = 'human' | 'bot';
export type PlayerStatus = 'waiting' | 'ready' | 'playing' | 'disconnected';
export type GamePhase =
  | 'lobby'
  | 'dealing'
  | 'bidding'
  | 'trump_selection'
  | 'partner_selection'
  | 'playing'
  | 'round_end'
  | 'game_end';
export type TeamId = 'A' | 'B';

export interface Card {
  id: string;
  suit: Suit;
  rank: Rank;
  points: number;
  deckColor: 'red' | 'blue';
}

export interface Player {
  id: string;
  name: string;
  type: PlayerType;
  status: PlayerStatus;
  isHost: boolean;
  seatIndex: number;
  socketId?: string;
  avatarUrl?: string; // base64 data URL or empty string
  /** True when this was a human player who disconnected and was auto-converted to a bot mid-game. */
  isSubstitutedBot?: boolean;
}

export interface BidState {
  currentBid: number;
  currentBidderId: string | null;
  bids: Array<{ playerId: string; amount: number | 'pass' }>;
  minBid: number;
  allPassed: boolean;
  winnerId: string | null;
}

export interface TrickCard {
  playerId: string;
  card: Card;
}

export interface Trick {
  id: string;
  cards: TrickCard[];
  leadSuit: Suit | null;
  winnerId: string | null;
  trickIndex: number;
}

export interface Team {
  id: TeamId;
  playerIds: string[];
  tricksWon: number;
  roundPoints: number;
  totalPoints: number;
}

export interface RoundHistory {
  roundNumber: number;
  bidWinnerId: string;
  bidAmount: number;
  trumpSuit: Suit;
  partnerCards: Card[];
  teams: { A: Team; B: Team };
  bidMade: boolean;
  playerRoundDeltas?: Record<string, number>; // per-player score change this round
}

export interface CalledCardSlot {
  typeId: string;       // e.g. "spades_A"
  ordinal: 1 | 2;       // which occurrence (1st or 2nd time typeId is played this round)
  assignedPartnerId: string | null;  // null = not yet assigned
  isVoid: boolean;      // true = bidder played it OR slot deduped
}

export interface GameState {
  roomId: string;
  phase: GamePhase;
  roundNumber: number;
  players: Player[];
  hands: Record<string, Card[]>;
  currentTrick: Trick | null;
  completedTricks: Trick[];
  bidState: BidState | null;
  trumpSuit: Suit | null;
  partnerCards: Card[];
  calledCards: Card[];
  bidWinnerId: string | null;
  partnerIds: string[];
  revealedPartnerIds: string[]; // starts empty, grows as partners play called cards
  calledCardSlots: CalledCardSlot[];
  playTypeCounters: Record<string, number>;
  teams: { A: Team; B: Team } | null;
  dealerIndex: number;
  currentTurnPlayerId: string | null;
  turnTimerEndsAt: number | null; // epoch ms when current turn timer expires
  roundHistory: RoundHistory[];
  winnerTeamId: TeamId | null;
  voteEndVotes?: Record<string, boolean>; // playerId → true (voted to end)
  playerTotals?: Record<string, number>;  // per-player cumulative score across rounds
}

export interface RoomConfig {
  preset: GamePreset;
  turnTimerSeconds: number; // 0 = no limit
  maxRounds: number; // 0 = unlimited
  targetScore: number; // winning score
  autoFillBots: boolean;
}

export interface Room {
  id: string;
  name: string;
  hostId: string;
  players: Player[];
  gameState: GameState | null;
  maxPlayers: number;
  createdAt: number;
  config: RoomConfig;
}

export interface Hand {
  playerId: string;
  cards: Card[];
}

export interface GameConfig {
  playerCount: number;
  cardsPerPlayer: number;
  totalTricks: number;
  deckCount: number;
  removedRanks: Rank[];
  cardValues: Record<string, number>;
  minBid: number;
  bidIncrement: number;
  partnerCount: number;
  totalRoundPoints: number;
  winningScore: number;
  trumpBeatsAll: boolean;
  mustFollowSuit: boolean;
  animationDurations: {
    cardDeal: number;
    cardPlay: number;
    trickCollect: number;
    partnerReveal: number;
  };
  turnTimerSeconds: number;
  botsEnabled: boolean;
  botDelayMs: number;
  soundEnabled: boolean;
  theme: 'dark' | 'light' | 'classic';
}

export interface CreateRoomPayload {
  roomName: string;
  playerName: string;
  config?: Partial<RoomConfig>;
}

export interface JoinRoomPayload {
  roomId: string;
  playerName: string;
}

export interface PlaceBidPayload {
  roomId: string;
  amount: number | 'pass';
}

export interface SelectTrumpPayload {
  roomId: string;
  suit: Suit;
}

export interface SelectPartnersPayload {
  roomId: string;
  cardIds: string[];
  cardSlots?: Array<{ typeId: string; ordinal: 1 | 2 }>;
}

export interface PlayCardPayload {
  roomId: string;
  cardId: string;
}

export interface AddBotPayload {
  roomId: string;
}

export interface ReconnectPayload {
  roomId: string;
  playerId: string;
}

export interface ChatMessage {
  id: string;
  playerId: string;
  playerName: string;
  text: string;
  timestamp: number;
}

export interface VoteEndPayload {
  roomId: string;
}
