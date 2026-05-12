import type { Card, Suit, Rank } from '@/types';

export const SUIT_SYMBOLS: Record<Suit, string> = {
  spades: '♠',
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
};

export const SUIT_COLORS: Record<Suit, string> = {
  spades: 'text-white',
  hearts: 'text-red-400',
  diamonds: 'text-red-400',
  clubs: 'text-white',
};

export const RANK_ORDER: Rank[] = [
  '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A',
];

/**
 * Returns a positive number if `a` beats `b`, negative if `b` beats `a`, 0 if equal.
 * Trump always beats non-trump; within the same suit the higher rank wins.
 * Off-suit non-trump cards beat nothing — returns 0 relative to each other.
 */
export function compareCards(
  a: Card,
  b: Card,
  trumpSuit: Suit | null,
  leadSuit: Suit,
): number {
  const aIsTrump = trumpSuit !== null && a.suit === trumpSuit;
  const bIsTrump = trumpSuit !== null && b.suit === trumpSuit;

  if (aIsTrump && !bIsTrump) return 1;
  if (!aIsTrump && bIsTrump) return -1;

  if (aIsTrump && bIsTrump) {
    return RANK_ORDER.indexOf(a.rank) - RANK_ORDER.indexOf(b.rank);
  }

  // Neither is trump
  const aIsLead = a.suit === leadSuit;
  const bIsLead = b.suit === leadSuit;

  if (aIsLead && !bIsLead) return 1;
  if (!aIsLead && bIsLead) return -1;

  if (aIsLead && bIsLead) {
    return RANK_ORDER.indexOf(a.rank) - RANK_ORDER.indexOf(b.rank);
  }

  // Both off-suit — neither can win
  return 0;
}

/** Returns true only for the 3 of spades. */
export function isSpecialCard(card: Pick<Card, 'suit' | 'rank'>): boolean {
  return card.suit === 'spades' && card.rank === '3';
}

/** Human-readable card name, e.g. "Ace of Spades" or "3 of Spades (30pts)". */
export function getCardDisplayName(card: Card): string {
  const rankNames: Record<Rank, string> = {
    '3': '3',
    '4': '4',
    '5': '5',
    '6': '6',
    '7': '7',
    '8': '8',
    '9': '9',
    '10': '10',
    J: 'Jack',
    Q: 'Queen',
    K: 'King',
    A: 'Ace',
  };

  const suitNames: Record<Suit, string> = {
    spades: 'Spades',
    hearts: 'Hearts',
    diamonds: 'Diamonds',
    clubs: 'Clubs',
  };

  const base = `${rankNames[card.rank]} of ${suitNames[card.suit]}`;
  if (isSpecialCard(card)) {
    return `${base} (30pts)`;
  }
  return base;
}

/**
 * Parses a card ID string (e.g. "spades_A") into its suit and rank components.
 * The ID format is `{suit}_{rank}` as produced by the deck engine.
 */
export function cardFromId(id: string): Pick<Card, 'suit' | 'rank'> {
  const idx = id.indexOf('_');
  const suit = id.substring(0, idx) as Suit;
  const rank = id.substring(idx + 1) as Rank;
  return { suit, rank };
}

/** Formats a point value for display, e.g. "30 pts". */
export function formatPoints(points: number): string {
  return `${points} pts`;
}
