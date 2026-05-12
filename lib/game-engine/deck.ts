import type { Card, Suit, Rank, GameConfig } from '@/types';

const SUITS: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];
const RANKS: Rank[] = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

/**
 * Returns the point value for a card.
 * Lookup order: specific `{rank}_{suit}` key, then generic `{rank}` key, then 0.
 */
export function getCardPoints(
  card: Pick<Card, 'suit' | 'rank'>,
  config: GameConfig,
): number {
  const specificKey = `${card.rank}_${card.suit}`;
  if (specificKey in config.cardValues) return config.cardValues[specificKey];
  if (card.rank in config.cardValues) return config.cardValues[card.rank];
  return 0;
}

/**
 * Returns the canonical type ID for a card (suit_rank), stripping any
 * double-deck suffix (_0 / _1). Used for partner matching in 2-deck games.
 */
export function getCardTypeId(card: Pick<Card, 'suit' | 'rank'>): string {
  return `${card.suit}_${card.rank}`;
}

/**
 * Creates the deck(s) based on config.deckCount.
 * - Single deck (deckCount=1): IDs are `suit_rank` (48 cards)
 * - Double deck (deckCount=2): IDs are `suit_rank_0` and `suit_rank_1` (96 cards)
 */
export function createDeck(config: GameConfig): Card[] {
  const count = config.deckCount ?? 1;
  const deck: Card[] = [];

  for (let d = 0; d < count; d++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        if (config.removedRanks.includes(rank)) continue;
        // Single-deck cards keep the plain ID; multi-deck cards get a suffix.
        const id = count === 1 ? `${suit}_${rank}` : `${suit}_${rank}_${d}`;
        deck.push({
          id,
          suit,
          rank,
          points: getCardPoints({ suit, rank }, config),
        });
      }
    }
  }
  return deck;
}

/** Fisher-Yates shuffle — returns a new shuffled array without mutating input. */
export function shuffleDeck(deck: Card[]): Card[] {
  const arr = [...deck];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Deals `config.cardsPerPlayer` cards to each player in round-robin order.
 * Returns a map of playerId → Card[].
 */
export function dealCards(
  deck: Card[],
  playerIds: string[],
  config: GameConfig,
): Record<string, Card[]> {
  const hands: Record<string, Card[]> = {};
  for (const id of playerIds) hands[id] = [];

  const total = playerIds.length * config.cardsPerPlayer;
  for (let i = 0; i < total; i++) {
    const playerId = playerIds[i % playerIds.length];
    hands[playerId].push(deck[i]);
  }
  return hands;
}

/**
 * Validates deck integrity: correct total count and no duplicate IDs.
 * Expected = 4 suits × 12 ranks × deckCount.
 */
export function validateDeckIntegrity(deck: Card[], deckCount = 1): boolean {
  const expected = SUITS.length * RANKS.length * deckCount;
  if (deck.length !== expected) return false;
  const ids = new Set(deck.map((c) => c.id));
  return ids.size === deck.length;
}

