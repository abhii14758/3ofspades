import type { GameState, Card, Suit, Trick, RoundHistory, Team, Player } from '@/types';
import type { GameConfig } from '@/types';
import { createDeck, shuffleDeck, dealCards, getCardTypeId } from './deck';
import { initBidState } from './bidEngine';
import { initTrick, playCard, resolveTrick, getTrickPoints } from './trickEngine';
import { calculateRoundScore, checkGameWinner, createInitialTeams } from './scoreEngine';
import { getNextPlayer, getPlayerToLeftOfDealer } from './turnManager';

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Creates a fresh GameState for the start of a new round.
 *
 * - Shuffles and deals the full 48-card deck to all players.
 * - Sets phase to 'dealing'.
 * - If `previousTeamTotals` is provided the teams placeholder carries those
 *   totals forward so `afterPartnersSelected` can restore them when real teams
 *   are formed later in the round.
 */
export function initRound(
  roomId: string,
  players: Player[],
  dealerIndex: number,
  roundNumber: number,
  previousTeamTotals: { A: number; B: number } | null,
  config: GameConfig,
): GameState {
  const deck = shuffleDeck(createDeck(config));
  const playerIds = [...players]
    .sort((a, b) => a.seatIndex - b.seatIndex)
    .map((p) => p.id);
  const hands = dealCards(deck, playerIds, config);

  // Placeholder teams carry previous totals until real teams are formed
  const placeholderTeams: { A: Team; B: Team } | null = previousTeamTotals
    ? {
        A: {
          id: 'A',
          playerIds: [],
          tricksWon: 0,
          roundPoints: 0,
          totalPoints: previousTeamTotals.A,
        },
        B: {
          id: 'B',
          playerIds: [],
          tricksWon: 0,
          roundPoints: 0,
          totalPoints: previousTeamTotals.B,
        },
      }
    : null;

  return {
    roomId,
    phase: 'dealing',
    roundNumber,
    players,
    hands,
    currentTrick: null,
    completedTricks: [],
    bidState: null,
    trumpSuit: null,
    partnerCards: [],
    calledCards: [],
    bidWinnerId: null,
    partnerIds: [],
    revealedPartnerIds: [],
    teams: placeholderTeams,
    dealerIndex,
    currentTurnPlayerId: null,
    turnTimerEndsAt: null,
    roundHistory: [],
    winnerTeamId: null,
  };
}

/**
 * Transitions from 'dealing' to 'bidding'.
 * Initialises the BidState so the first player (left of dealer) can open.
 */
export function startBidding(gameState: GameState, config: GameConfig): GameState {
  const bidState = initBidState(gameState.players, gameState.dealerIndex, config);
  return {
    ...gameState,
    phase: 'bidding',
    bidState,
    currentTurnPlayerId: bidState.currentBidderId,
  };
}

/**
 * Called after the bid winner is determined.
 * Transitions to 'trump_selection' and sets the active player to the winner.
 */
export function afterBidWon(
  gameState: GameState,
  winnerId: string,
  bidAmount: number,
  config: GameConfig,
): GameState {
  const updatedBidState = gameState.bidState
    ? {
        ...gameState.bidState,
        winnerId,
        currentBid: bidAmount,
        currentBidderId: null,
      }
    : null;

  void config;

  return {
    ...gameState,
    phase: 'trump_selection',
    bidWinnerId: winnerId,
    bidState: updatedBidState,
    currentTurnPlayerId: winnerId,
  };
}

/**
 * Records the trump suit selected by the bid winner.
 * Transitions to 'partner_selection'.
 */
export function afterTrumpSelected(gameState: GameState, trumpSuit: Suit): GameState {
  return {
    ...gameState,
    phase: 'partner_selection',
    trumpSuit,
  };
}

/**
 * Records the partner cards called by the bid winner and sets up teams.
 *
 * - calledCardTypeIds are type IDs like "spades_K"; duplicates allowed for count=2
 * - Looks through all hands to identify which players hold a card of each called type.
 * - Those players (excluding the bid winner) become Team A partners.
 * - Team B = remaining players.
 * - Previous round totals are carried forward from the placeholder teams.
 * - Transitions to 'playing'; first trick lead goes to the bid winner (fallback: player left of dealer).
 */
export function afterPartnersSelected(
  gameState: GameState,
  calledCardTypeIds: string[], // type IDs like "spades_K"; duplicates allowed for count=2
): GameState {
  // Build display cards — one entry per UNIQUE type ID
  const uniqueTypeIds = [...new Set(calledCardTypeIds)];
  const allCards: Card[] = Object.values(gameState.hands).flat();

  const calledCards: Card[] = uniqueTypeIds.map((typeId) => {
    const found = allCards.find((c) => getCardTypeId(c) === typeId);
    if (!found) {
      const parts = typeId.split('_');
      const suit = parts[0] as Card['suit'];
      const rank = parts.slice(1).join('_') as Card['rank'];
      return { id: typeId, suit, rank, points: 0, deckColor: 'red' as const };
    }
    return { ...found, id: typeId };
  });

  // Find partners — one per slot in calledCardTypeIds (supports duplicate typeIds for count=2)
  const partnerIds: string[] = [];
  for (const typeId of calledCardTypeIds) {
    for (const [pid, hand] of Object.entries(gameState.hands)) {
      if (pid === gameState.bidWinnerId) continue;
      if (partnerIds.includes(pid)) continue; // already assigned
      const holds = hand.some((c) => getCardTypeId(c) === typeId);
      if (holds) {
        partnerIds.push(pid);
        break;
      }
    }
  }

  const allPlayerIds = gameState.players.map((p) => p.id);
  const teams = createInitialTeams(gameState.bidWinnerId!, partnerIds, allPlayerIds);

  teams.A.totalPoints = gameState.teams?.A.totalPoints ?? 0;
  teams.B.totalPoints = gameState.teams?.B.totalPoints ?? 0;

  const bidWinnerPlayer = gameState.players.find((p) => p.id === gameState.bidWinnerId);
  const leadPlayer = bidWinnerPlayer ?? getPlayerToLeftOfDealer(gameState.players, gameState.dealerIndex);
  const firstTrick = initTrick(0);

  return {
    ...gameState,
    phase: 'playing',
    calledCards,
    partnerCards: calledCards,
    partnerIds,
    teams,
    currentTrick: firstTrick,
    currentTurnPlayerId: leadPlayer.id,
  };
}

/**
 * Processes a single card play within a trick.
 *
 * Steps:
 * 1. Remove the card from the player's hand.
 * 2. Add the card to the current trick.
 * 3. Check if the played card is one of the called partner cards → reveal.
 * 4. If the trick is now complete (all players have played):
 *    a. Resolve the winner.
 *    b. Update team trick counts and round points.
 *    c. Start the next trick (winner leads) or mark all tricks done.
 * 5. Otherwise advance the turn to the next player.
 *
 * Returns the updated state plus flags for UI notifications.
 */
export function processCardPlay(
  gameState: GameState,
  playerId: string,
  card: Card,
  config: GameConfig,
): {
  newState: GameState;
  trickComplete: boolean;
  partnerRevealed: boolean;
  revealedPartnerId?: string;
} {
  // 1. Remove card from hand
  const updatedHands: Record<string, Card[]> = {
    ...gameState.hands,
    [playerId]: (gameState.hands[playerId] ?? []).filter((c) => c.id !== card.id),
  };

  // 2. Add card to current trick
  const updatedTrick = playCard(gameState.currentTrick!, playerId, card);

  // 3. Partner reveal check — match by type ID so double-deck copies are caught
  let partnerRevealed = false;
  let revealedPartnerId: string | undefined;
  let updatedPartnerIds = [...gameState.partnerIds];
  let updatedRevealedPartnerIds = [...(gameState.revealedPartnerIds ?? [])];

  // NEW — type-based match:
  const cardTypeId = getCardTypeId(card);
  const isCalledCard = gameState.calledCards.some((cc) => cc.id === cardTypeId);
  if (
    isCalledCard &&
    playerId !== gameState.bidWinnerId &&
    !updatedRevealedPartnerIds.includes(playerId)
  ) {
    partnerRevealed = true;
    revealedPartnerId = playerId;
    updatedPartnerIds = [...updatedPartnerIds, playerId];
    updatedRevealedPartnerIds = [...updatedRevealedPartnerIds, playerId];
  }

  const trickComplete = updatedTrick.cards.length === gameState.players.length;

  let newState: GameState;

  if (trickComplete) {
    // 4a. Resolve trick
    const winnerId = resolveTrick(updatedTrick, gameState.trumpSuit, config);
    const resolvedTrick: Trick = { ...updatedTrick, winnerId };
    const completedTricks = [...gameState.completedTricks, resolvedTrick];

    // 4b. Update team stats (carry forward accumulated totals)
    let updatedTeams = gameState.teams
      ? {
          A: { ...gameState.teams.A },
          B: { ...gameState.teams.B },
        }
      : null;

    if (updatedTeams) {
      const pts = getTrickPoints(resolvedTrick);
      if (updatedTeams.A.playerIds.includes(winnerId)) {
        updatedTeams.A.tricksWon++;
        updatedTeams.A.roundPoints += pts;
      } else {
        updatedTeams.B.tricksWon++;
        updatedTeams.B.roundPoints += pts;
      }
    }

    const allTricksDone = completedTricks.length >= config.totalTricks;

    if (allTricksDone) {
      // 4c. All tricks complete — let finalizeRound handle scoring
      newState = {
        ...gameState,
        hands: updatedHands,
        currentTrick: null,
        completedTricks,
        teams: updatedTeams,
        partnerIds: updatedPartnerIds,
        revealedPartnerIds: updatedRevealedPartnerIds,
        currentTurnPlayerId: null,
      };
    } else {
      // 4d. Start the next trick; the trick winner leads
      const nextTrick = initTrick(completedTricks.length);
      newState = {
        ...gameState,
        hands: updatedHands,
        currentTrick: nextTrick,
        completedTricks,
        teams: updatedTeams,
        partnerIds: updatedPartnerIds,
        revealedPartnerIds: updatedRevealedPartnerIds,
        currentTurnPlayerId: winnerId,
      };
    }
  } else {
    // 5. Advance turn
    const nextPlayerId = getNextPlayer(playerId, gameState.players);
    newState = {
      ...gameState,
      hands: updatedHands,
      currentTrick: updatedTrick,
      partnerIds: updatedPartnerIds,
      revealedPartnerIds: updatedRevealedPartnerIds,
      currentTurnPlayerId: nextPlayerId,
    };
  }

  return { newState, trickComplete, partnerRevealed, revealedPartnerId };
}

/**
 * Finalises the round after all tricks are complete.
 *
 * - Calculates round scores (bid made / bid failed).
 * - Checks for a game winner.
 * - Appends a RoundHistory entry.
 * - Transitions phase to 'round_end' or 'game_end'.
 */
export function finalizeRound(gameState: GameState, config: GameConfig): GameState {
  if (!gameState.teams || !gameState.bidWinnerId || !gameState.bidState) {
    return { ...gameState, phase: 'round_end' };
  }

  const bidAmount = gameState.bidState.currentBid;

  const { A, B, bidMade } = calculateRoundScore(
    gameState.completedTricks,
    gameState.teams,
    gameState.bidWinnerId,
    bidAmount,
    config,
  );

  const updatedTeams = { A, B };
  const winnerTeamId = checkGameWinner(updatedTeams, config);

  const historyEntry: RoundHistory = {
    roundNumber: gameState.roundNumber,
    bidWinnerId: gameState.bidWinnerId,
    bidAmount,
    trumpSuit: gameState.trumpSuit!,
    partnerCards: gameState.partnerCards,
    teams: {
      A: { ...updatedTeams.A },
      B: { ...updatedTeams.B },
    },
    bidMade,
  };

  return {
    ...gameState,
    phase: winnerTeamId ? 'game_end' : 'round_end',
    teams: updatedTeams,
    winnerTeamId,
    roundHistory: [...gameState.roundHistory, historyEntry],
  };
}
