import type { GameConfig, GamePreset, RoomConfig } from '@/types';

// ─── Shared card values (same for all presets) ────────────────────────────────
const CARD_VALUES: Record<string, number> = {
  '3_spades': 30,
  A: 10, K: 10, Q: 10, J: 10, '10': 10, '5': 5,
};

// ─── Base game config (shared defaults) ──────────────────────────────────────
const BASE_CONFIG = {
  removedRanks: [] as GameConfig['removedRanks'],
  cardValues: CARD_VALUES,
  bidIncrement: 10,
  trumpBeatsAll: true,
  mustFollowSuit: true,
  animationDurations: { cardDeal: 600, cardPlay: 400, trickCollect: 800, partnerReveal: 1200 },
  botsEnabled: true,
  botDelayMs: 1200,
  soundEnabled: false,
  theme: 'dark' as const,
  turnTimerSeconds: 30,
  winningScore: 500,
};

// ─── 4 Game Mode Presets ──────────────────────────────────────────────────────

/**
 * 4 Players · One Deck (48 cards)
 * 12 cards/player · 12 tricks · 250 pts · min bid 150 · 1 partner
 */
const PRESET_4P1D: GameConfig = {
  ...BASE_CONFIG,
  playerCount: 4,
  deckCount: 1,
  cardsPerPlayer: 12,
  totalTricks: 12,
  minBid: 150,
  partnerCount: 1,
  totalRoundPoints: 250,
};

/**
 * 6 Players · One Deck (48 cards)  [DEFAULT]
 * 8 cards/player · 8 tricks · 250 pts · min bid 130 · 2 partners
 */
const PRESET_6P1D: GameConfig = {
  ...BASE_CONFIG,
  playerCount: 6,
  deckCount: 1,
  cardsPerPlayer: 8,
  totalTricks: 8,
  minBid: 130,
  partnerCount: 2,
  totalRoundPoints: 250,
};

/**
 * 6 Players · Two Decks (96 cards)
 * 16 cards/player · 16 tricks · 500 pts · min bid 260 · 2 partners
 */
const PRESET_6P2D: GameConfig = {
  ...BASE_CONFIG,
  playerCount: 6,
  deckCount: 2,
  cardsPerPlayer: 16,
  totalTricks: 16,
  minBid: 260,
  partnerCount: 2,
  totalRoundPoints: 500,
};

/**
 * 8 Players · Two Decks (96 cards)
 * 12 cards/player · 12 tricks · 500 pts · min bid 200 · 3 partners
 */
const PRESET_8P2D: GameConfig = {
  ...BASE_CONFIG,
  playerCount: 8,
  deckCount: 2,
  cardsPerPlayer: 12,
  totalTricks: 12,
  minBid: 200,
  partnerCount: 3,
  totalRoundPoints: 500,
};

/**
 * 10 Players · Two Decks (96 cards)
 * 9 cards/player · 9 tricks · 500 pts · min bid 250 · 4 partners
 * (6 cards burned from the 96-card double deck)
 */
const PRESET_10P2D: GameConfig = {
  ...BASE_CONFIG,
  playerCount: 10,
  deckCount: 2,
  cardsPerPlayer: 9,
  totalTricks: 9,
  minBid: 250,
  partnerCount: 4,
  totalRoundPoints: 500,
};

export const GAME_PRESETS: Record<GamePreset, GameConfig> = {
  '4p1d': PRESET_4P1D,
  '6p1d': PRESET_6P1D,
  '6p2d': PRESET_6P2D,
  '8p2d': PRESET_8P2D,
  '10p2d': PRESET_10P2D,
};

/** Returns the GameConfig for a given preset, overriding turn timer from room config. */
export function getConfigForPreset(
  preset: GamePreset,
  roomTurnTimerSeconds?: number,
): GameConfig {
  const base = GAME_PRESETS[preset];
  return {
    ...base,
    turnTimerSeconds: roomTurnTimerSeconds ?? base.turnTimerSeconds,
  };
}

// ─── Default (global fallback) ────────────────────────────────────────────────
export let gameConfig: GameConfig = { ...PRESET_6P1D };

export function updateConfig(partial: Partial<GameConfig>): void {
  gameConfig = { ...gameConfig, ...partial };
}

export const defaultRoomConfig: RoomConfig = {
  preset: '6p1d',
  turnTimerSeconds: 60,
  maxRounds: 0,
  targetScore: 500,
  autoFillBots: false,
};

export default PRESET_6P1D;

