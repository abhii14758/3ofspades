import type { Card, GameState, GameConfig, Suit, BidState, Rank, Trick } from '@/types';

// ─── Constants ────────────────────────────────────────────────────────────────

const RANK_VALUES: Record<Rank, number> = {
  '3': 1,
  '4': 2,
  '5': 3,
  '6': 4,
  '7': 5,
  '8': 6,
  '9': 7,
  '10': 8,
  J: 9,
  Q: 10,
  K: 11,
  A: 12,
};

const ALL_SUITS: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];
const ALL_RANKS: Rank[] = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

// ─── Deck builder (exported for server use) ───────────────────────────────────

export function buildFullDeck(config: GameConfig): Card[] {
  const count = config.deckCount ?? 1;
  const colors: Array<'red' | 'blue'> = ['red', 'blue'];
  const cards: Card[] = [];

  for (let d = 0; d < count; d++) {
    const deckColor = colors[d] ?? 'red';
    for (const suit of ALL_SUITS) {
      for (const rank of ALL_RANKS) {
        if (config.removedRanks.includes(rank)) continue;
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

// ─── Trick valuation helpers ──────────────────────────────────────────────────

/**
 * Returns a numeric "winning power" for a card given the trick context.
 * Trump cards outrank lead-suit cards.
 * Off-suit non-trump cards score 0 (cannot win).
 */
function getCardTrickValue(card: Card, leadSuit: Suit | null, trumpSuit: Suit | null): number {
  if (trumpSuit && card.suit === trumpSuit) {
    return RANK_VALUES[card.rank] + 100;
  }
  if (leadSuit && card.suit === leadSuit) {
    return RANK_VALUES[card.rank];
  }
  return 0;
}

function getCurrentTrickWinner(trick: Trick, trumpSuit: Suit | null): Card {
  const leadSuit = trick.leadSuit;
  let winner = trick.cards[0].card;
  for (let i = 1; i < trick.cards.length; i++) {
    const c = trick.cards[i].card;
    if (
      getCardTrickValue(c, leadSuit, trumpSuit) >=
      getCardTrickValue(winner, leadSuit, trumpSuit)
    ) {
      winner = c;
    }
  }
  return winner;
}

// ─── Exported bot decision functions ─────────────────────────────────────────

/**
 * Decide bid amount or pass.
 * Uses a conservative estimate: team of 3 will score ~2.8× this player's hand strength.
 * Never bids higher than what the team can realistically score.
 */
export function botDecideBid(
  hand: Card[],
  bidState: BidState,
  config: GameConfig,
): number | 'pass' {
  // Forced bid when all others have passed (dealer obligation)
  if (bidState.allPassed) return config.minBid;

  const handStrength = hand.reduce((sum, c) => sum + c.points, 0);

  // Next valid bid
  const nextBid = Math.max((bidState.currentBid ?? 0) + config.bidIncrement, config.minBid);

  // Conservative team-score estimate
  const estimatedTeamScore = handStrength * 2.8;

  if (handStrength < 45) return 'pass';
  if (estimatedTeamScore < nextBid + 15) return 'pass';

  // Cap at what the team can realistically achieve
  const maxReasonableBid =
    Math.floor((estimatedTeamScore - 15) / config.bidIncrement) * config.bidIncrement;

  if (nextBid > maxReasonableBid) return 'pass';

  return nextBid;
}

/**
 * Select trump suit.
 * Scores each suit by card count and point potential.
 * Adds a small spades preference bonus (historically dominant suit).
 */
export function botSelectTrump(hand: Card[], _config: GameConfig): Suit {
  const suitScore: Partial<Record<Suit, number>> = {};

  for (const card of hand) {
    const current = suitScore[card.suit] ?? 0;
    suitScore[card.suit] = current + card.points + RANK_VALUES[card.rank];
  }

  // Slight spades preference: historically strong suit
  suitScore['spades'] = (suitScore['spades'] ?? 0) + 10;

  let best: Suit = 'spades';
  let bestScore = -1;
  for (const suit of ALL_SUITS) {
    const score = suitScore[suit] ?? 0;
    if (score > bestScore) {
      bestScore = score;
      best = suit;
    }
  }
  return best;
}

/**
 * Select partner cards.
 * Calls the highest-ranking cards not in the bot's own hand,
 * preferring cards from different suits so partners are spread across the table.
 * Uses config.partnerCount to select the right number of partner cards.
 *
 * Uses canonical type IDs (e.g. "spades_A") so it works for both single and double deck.
 */
export function botSelectPartnerCards(
  hand: Card[],
  allCards: Card[],
  config: GameConfig,
): string[] {
  const partnerCount = config.partnerCount ?? 2;

  // Build set of canonical type IDs held in bot's hand
  const toTypeId = (card: Card) => `${card.suit}_${card.rank}`;
  const handTypeIds = new Set(hand.map((c) => toTypeId(c)));

  // All distinct canonical type IDs from the full deck
  const seenTypeIds = new Set<string>();
  const candidates: Card[] = [];
  for (const c of allCards) {
    const typeId = toTypeId(c);
    if (!handTypeIds.has(typeId) && !seenTypeIds.has(typeId)) {
      seenTypeIds.add(typeId);
      // Use canonical id for partner selection
      candidates.push({ ...c, id: typeId });
    }
  }

  candidates.sort((a, b) => {
    const rankDiff = RANK_VALUES[b.rank] - RANK_VALUES[a.rank];
    if (rankDiff !== 0) return rankDiff;
    return b.points - a.points;
  });

  const selected: string[] = [];
  const usedSuits = new Set<Suit>();

  // First pass: prefer different suits for diversity
  for (const card of candidates) {
    if (selected.length >= partnerCount) break;
    if (!usedSuits.has(card.suit)) {
      selected.push(card.id);
      usedSuits.add(card.suit);
    }
  }

  // Second pass: fill remaining slots
  for (const card of candidates) {
    if (selected.length >= partnerCount) break;
    if (!selected.includes(card.id)) selected.push(card.id);
  }

  return selected.slice(0, partnerCount);
}

/**
 * Select which card to play from hand.
 *
 * Strategy:
 *   Leading a trick  → highest-scoring card of the longest non-trump suit.
 *   Following suit   → lowest winning card if possible; else discard cheapest.
 *   Off-suit         → lowest winning trump if possible; else discard cheapest non-trump.
 */
export function botSelectCard(
  hand: Card[],
  gameState: GameState,
  _botPlayerId: string,
  _config: GameConfig,
): Card {
  const trick = gameState.currentTrick;
  const trumpSuit = gameState.trumpSuit;

  if (!trick || trick.cards.length === 0) {
    return selectLeadCard(hand, trumpSuit);
  }

  const leadSuit = trick.leadSuit!;
  const suitCards = hand.filter((c) => c.suit === leadSuit);

  if (suitCards.length > 0) {
    return selectFollowSuitCard(suitCards, trick, trumpSuit);
  }
  return selectDiscardOrTrumpCard(hand, trick, trumpSuit);
}

// ─── Private helpers ──────────────────────────────────────────────────────────

function selectLeadCard(hand: Card[], trumpSuit: Suit | null): Card {
  const groups: Partial<Record<Suit, Card[]>> = {};
  for (const card of hand) {
    if (!groups[card.suit]) groups[card.suit] = [];
    groups[card.suit]!.push(card);
  }

  // Prefer the longest non-trump suit; fall back to any suit if only trump remains
  const targetSuits = (Object.keys(groups) as Suit[]).filter((s) => s !== trumpSuit);
  const pool = targetSuits.length > 0 ? targetSuits : (Object.keys(groups) as Suit[]);

  let bestGroup: Card[] = hand;
  let bestScore = -1;
  for (const suit of pool) {
    const cards = groups[suit]!;
    // Weight count heavily, then raw points
    const score = cards.length * 100 + cards.reduce((s, c) => s + c.points, 0);
    if (score > bestScore) {
      bestScore = score;
      bestGroup = cards;
    }
  }

  // Lead with the highest-scoring card in that suit
  return bestGroup.reduce((best, c) => (c.points > best.points ? c : best), bestGroup[0]);
}

function selectFollowSuitCard(
  suitCards: Card[],
  trick: Trick,
  trumpSuit: Suit | null,
): Card {
  const leadSuit = trick.leadSuit!;
  const winnerCard = getCurrentTrickWinner(trick, trumpSuit);
  const winnerValue = getCardTrickValue(winnerCard, leadSuit, trumpSuit);

  // Try to win with the cheapest winning card (conserve high cards)
  const winningCards = suitCards.filter(
    (c) => getCardTrickValue(c, leadSuit, trumpSuit) > winnerValue,
  );

  if (winningCards.length > 0) {
    return winningCards.reduce((best, c) =>
      getCardTrickValue(c, leadSuit, trumpSuit) < getCardTrickValue(best, leadSuit, trumpSuit)
        ? c
        : best,
      winningCards[0],
    );
  }

  // Cannot win — discard the least valuable card
  return suitCards.reduce((lowest, c) => (c.points < lowest.points ? c : lowest), suitCards[0]);
}

function selectDiscardOrTrumpCard(hand: Card[], trick: Trick, trumpSuit: Suit | null): Card {
  const leadSuit = trick.leadSuit!;
  const winnerCard = getCurrentTrickWinner(trick, trumpSuit);
  const winnerValue = getCardTrickValue(winnerCard, leadSuit, trumpSuit);

  if (trumpSuit) {
    const trumpCards = hand.filter((c) => c.suit === trumpSuit);
    if (trumpCards.length > 0) {
      const winningTrumps = trumpCards.filter(
        (c) => getCardTrickValue(c, leadSuit, trumpSuit) > winnerValue,
      );
      if (winningTrumps.length > 0) {
        // Use the weakest winning trump to preserve high trumps
        return winningTrumps.reduce((best, c) =>
          getCardTrickValue(c, leadSuit, trumpSuit) <
          getCardTrickValue(best, leadSuit, trumpSuit)
            ? c
            : best,
          winningTrumps[0],
        );
      }
    }
  }

  // Discard cheapest non-trump; if all trump remain, discard cheapest trump
  const nonTrump = hand.filter((c) => c.suit !== trumpSuit);
  const pool = nonTrump.length > 0 ? nonTrump : hand;
  return pool.reduce((lowest, c) => (c.points < lowest.points ? c : lowest), pool[0]);
}
