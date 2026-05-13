import type { GameState, Suit, GameConfig } from '@/types';
import { canPlayCard } from './trickEngine';
import { validateBid } from './bidEngine';

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Validates whether a player may legally play a card at this moment.
 *
 * Checks (in order):
 * 1. Game phase must be 'playing'.
 * 2. Player must exist and not be disconnected.
 * 3. It must be the player's turn.
 * 4. Card must be in the player's hand.
 * 5. Card must satisfy follow-suit rules via trickEngine.
 */
export function validateCardPlay(
  gameState: GameState,
  playerId: string,
  cardId: string,
  config: GameConfig,
): { valid: boolean; error?: string } {
  if (gameState.phase !== 'playing') {
    return { valid: false, error: 'Cards can only be played during the playing phase.' };
  }

  const player = gameState.players.find((p) => p.id === playerId);
  if (!player) {
    return { valid: false, error: 'Player not found.' };
  }
  if (player.status === 'disconnected') {
    return { valid: false, error: 'Disconnected players cannot play cards.' };
  }

  if (gameState.currentTurnPlayerId !== playerId) {
    return { valid: false, error: 'It is not your turn.' };
  }

  const hand = gameState.hands[playerId] ?? [];
  const card = hand.find((c) => c.id === cardId);
  if (!card) {
    return { valid: false, error: 'That card is not in your hand.' };
  }

  if (!gameState.currentTrick) {
    return { valid: false, error: 'No active trick to play into.' };
  }

  return canPlayCard(hand, card, gameState.currentTrick, gameState.trumpSuit, config);
}

/**
 * Validates whether a player may place a bid at this moment.
 *
 * Checks (in order):
 * 1. Game phase must be 'bidding'.
 * 2. BidState must exist.
 * 3. The bid itself must be valid (delegates to bidEngine.validateBid).
 */
export function validateBidAction(
  gameState: GameState,
  playerId: string,
  amount: number | 'pass',
  config: GameConfig,
): { valid: boolean; error?: string } {
  if (gameState.phase !== 'bidding') {
    return { valid: false, error: 'Bidding is not currently active.' };
  }

  if (!gameState.bidState) {
    return { valid: false, error: 'Bid state is not initialised.' };
  }

  return validateBid(gameState.bidState, playerId, amount, config);
}

/**
 * Validates whether a player may select the trump suit at this moment.
 *
 * Checks:
 * 1. Game phase must be 'trump_selection'.
 * 2. Player must be the bid winner.
 */
export function validateTrumpSelection(
  gameState: GameState,
  playerId: string,
  suit: Suit,
): { valid: boolean; error?: string } {
  if (gameState.phase !== 'trump_selection') {
    return { valid: false, error: 'Trump selection is not currently active.' };
  }

  if (gameState.bidWinnerId !== playerId) {
    return { valid: false, error: 'Only the bid winner may select trump.' };
  }

  // suit is typed as Suit so no further check is needed
  void suit;

  return { valid: true };
}

/**
 * Validates whether a player may select partner cards at this moment.
 *
 * Checks:
 * 1. Game phase must be 'partner_selection'.
 * 2. Player must be the bid winner.
 * 3. Exactly `config.partnerCount` cards must be provided.
 * 4. All card IDs must be valid (proper suit_rank format).
 * 5. No typeId can be selected more times than it exists in the deck.
 */
export function validatePartnerSelection(
  gameState: GameState,
  playerId: string,
  cardIds: string[], // these are typeIds: "suit_rank" format
  config: GameConfig,
): { valid: boolean; error?: string } {
  if (gameState.phase !== 'partner_selection') {
    return { valid: false, error: 'Partner selection is not currently active.' };
  }

  if (gameState.bidWinnerId !== playerId) {
    return { valid: false, error: 'Only the bid winner may select partner cards.' };
  }

  if (cardIds.length !== config.partnerCount) {
    return {
      valid: false,
      error: `You must select exactly ${config.partnerCount} partner card(s).`,
    };
  }

  const validSuits = new Set(['spades', 'hearts', 'diamonds', 'clubs']);
  const validRanks = new Set(['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']);
  const deckCount = config.deckCount ?? 1;

  // Count occurrences of each typeId — max allowed = deckCount
  const typeCounts: Record<string, number> = {};
  for (const cardId of cardIds) {
    const underscoreIdx = cardId.indexOf('_');
    if (underscoreIdx === -1) {
      return { valid: false, error: `Invalid card ID format: "${cardId}".` };
    }
    const suit = cardId.substring(0, underscoreIdx);
    const rank = cardId.substring(underscoreIdx + 1);
    if (!validSuits.has(suit) || !validRanks.has(rank)) {
      return { valid: false, error: `Unknown card: "${cardId}".` };
    }
    typeCounts[cardId] = (typeCounts[cardId] ?? 0) + 1;
    if (typeCounts[cardId] > deckCount) {
      return { valid: false, error: `Cannot select more copies of "${cardId}" than exist in the deck.` };
    }
  }

  return { valid: true };
}
