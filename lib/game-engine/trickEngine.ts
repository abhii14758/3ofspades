import type { Card, Trick, Suit, Rank, GameConfig } from '@/types';

const RANK_ORDER: Rank[] = [
  '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A',
];

// ─── Private helpers ─────────────────────────────────────────────────────────

/**
 * Returns true if `challenger` beats `current` given the lead suit and trump.
 *
 * Priority:
 *   1. Trump beats non-trump.
 *   2. Between two trumps: higher rank wins.
 *   3. Lead-suit card beats off-suit non-trump.
 *   4. Between two lead-suit cards: higher rank wins.
 *   5. Two off-suit non-trump cards: challenger does NOT beat current.
 */
function cardBeats(
  challenger: Card,
  current: Card,
  leadSuit: Suit,
  trumpSuit: Suit | null,
): boolean {
  const cIsTrump = trumpSuit !== null && challenger.suit === trumpSuit;
  const wIsTrump = trumpSuit !== null && current.suit === trumpSuit;

  if (cIsTrump && !wIsTrump) return true;
  if (!cIsTrump && wIsTrump) return false;

  if (cIsTrump && wIsTrump) {
    return RANK_ORDER.indexOf(challenger.rank) > RANK_ORDER.indexOf(current.rank);
  }

  // Neither is trump
  const cIsLead = challenger.suit === leadSuit;
  const wIsLead = current.suit === leadSuit;

  if (cIsLead && !wIsLead) return true;
  if (!cIsLead && wIsLead) return false;

  if (cIsLead && wIsLead) {
    return RANK_ORDER.indexOf(challenger.rank) > RANK_ORDER.indexOf(current.rank);
  }

  // Both off-suit — challenger cannot beat current
  return false;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Creates a blank Trick for the given trickIndex. */
export function initTrick(trickIndex: number): Trick {
  return {
    id: `trick_${trickIndex}`,
    cards: [],
    leadSuit: null,
    winnerId: null,
    trickIndex,
  };
}

/**
 * Validates whether a card may be legally played given the current trick and hand.
 *
 * - If the trick has no cards yet: any card is valid.
 * - If the player holds a card matching the lead suit they MUST follow suit.
 * - Otherwise any card (including trump) may be played.
 */
export function canPlayCard(
  hand: Card[],
  card: Card,
  trick: Trick,
  trumpSuit: Suit | null,
  config: GameConfig,
): { valid: boolean; error?: string } {
  // First card in trick — anything goes
  if (!config.mustFollowSuit || trick.leadSuit === null) {
    return { valid: true };
  }

  if (card.suit === trick.leadSuit) {
    return { valid: true };
  }

  // Card is NOT lead suit — check if player has any lead-suit card
  const hasLeadSuit = hand.some((c) => c.suit === trick.leadSuit);
  if (hasLeadSuit) {
    return {
      valid: false,
      error: `You must follow the lead suit (${trick.leadSuit}).`,
    };
  }

  return { valid: true };
}

/**
 * Adds `card` to the trick for `playerId`.
 * Sets `leadSuit` if this is the first card in the trick.
 * Returns a new Trick object (does not mutate the original).
 */
export function playCard(trick: Trick, playerId: string, card: Card): Trick {
  const updatedCards = [...trick.cards, { playerId, card }];
  const leadSuit = trick.leadSuit ?? card.suit;
  return { ...trick, cards: updatedCards, leadSuit };
}

/**
 * Determines the winner of a completed trick.
 *
 * - Trump beats non-trump (when `trumpSuit` is set).
 * - Highest trump wins if multiple trump cards are played.
 * - Highest card of lead suit wins when no trump is played.
 * - Rank order: 3 < 4 < 5 < 6 < 7 < 8 < 9 < 10 < J < Q < K < A
 *
 * Returns the `playerId` of the winner.
 */
export function resolveTrick(
  trick: Trick,
  trumpSuit: Suit | null,
  config: GameConfig,
): string {
  if (trick.cards.length === 0) {
    throw new Error('Cannot resolve an empty trick.');
  }
  if (!trick.leadSuit) {
    throw new Error('Trick has no lead suit set.');
  }

  let winner = trick.cards[0];

  for (let i = 1; i < trick.cards.length; i++) {
    const candidate = trick.cards[i];
    if (cardBeats(candidate.card, winner.card, trick.leadSuit, trumpSuit)) {
      winner = candidate;
    }
  }

  return winner.playerId;
}

/** Sums the point values of all cards in the trick. */
export function getTrickPoints(trick: Trick): number {
  return trick.cards.reduce((sum, tc) => sum + tc.card.points, 0);
}
