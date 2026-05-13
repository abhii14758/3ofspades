import type { GameState, Card, Suit, Trick, RoundHistory, Team, Player, CalledCardSlot, TeamId } from '@/types';
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
    calledCardSlots: [],
    playTypeCounters: {},
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
 * Partners are assigned DYNAMICALLY as called cards are played — only the
 * bidder starts on Team A. All others start on Team B and move to A when
 * they play their assigned called card.
 */
export function afterPartnersSelected(
  gameState: GameState,
  slots: CalledCardSlot[],
): GameState {
  // Build display cards — one per unique typeId
  const uniqueTypeIds = [...new Set(slots.map(s => s.typeId))];
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

  // Only bidder on Team A initially — partners join dynamically
  const allPlayerIds = gameState.players.map((p) => p.id);
  const teams = {
    A: {
      id: 'A' as TeamId,
      playerIds: [gameState.bidWinnerId!],
      tricksWon: 0,
      roundPoints: 0,
      totalPoints: gameState.teams?.A.totalPoints ?? 0,
    },
    B: {
      id: 'B' as TeamId,
      playerIds: allPlayerIds.filter(id => id !== gameState.bidWinnerId),
      tricksWon: 0,
      roundPoints: 0,
      totalPoints: gameState.teams?.B.totalPoints ?? 0,
    },
  };

  const bidWinnerPlayer = gameState.players.find((p) => p.id === gameState.bidWinnerId);
  const leadPlayer = bidWinnerPlayer ?? getPlayerToLeftOfDealer(gameState.players, gameState.dealerIndex);
  const firstTrick = initTrick(0);

  return {
    ...gameState,
    phase: 'playing',
    calledCards,
    partnerCards: calledCards,
    calledCardSlots: slots,
    playTypeCounters: {},
    partnerIds: [],
    revealedPartnerIds: [],
    teams,
    currentTrick: firstTrick,
    currentTurnPlayerId: leadPlayer.id,
  };
}

// ─── Private helpers ──────────────────────────────────────────────────────────

function recalculateTeamPoints(
  completedTricks: Trick[],
  teams: { A: Team; B: Team },
): { A: Team; B: Team } {
  const newA = { ...teams.A, tricksWon: 0, roundPoints: 0 };
  const newB = { ...teams.B, tricksWon: 0, roundPoints: 0 };
  for (const trick of completedTricks) {
    if (!trick.winnerId) continue;
    const pts = getTrickPoints(trick);
    if (newA.playerIds.includes(trick.winnerId)) {
      newA.tricksWon++;
      newA.roundPoints += pts;
    } else {
      newB.tricksWon++;
      newB.roundPoints += pts;
    }
  }
  return { A: newA, B: newB };
}

/**
 * Processes a single card play within a trick.
 *
 * Steps:
 * 1. Remove the card from the player's hand.
 * 2. Add the card to the current trick.
 * 3. Dynamic partner reveal — match by CalledCardSlot typeId + ordinal.
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

  // 3. Dynamic partner reveal — check if this play matches any unfilled CalledCardSlot
  let partnerRevealed = false;
  let revealedPartnerId: string | undefined;
  let updatedPartnerIds = [...gameState.partnerIds];
  let updatedRevealedPartnerIds = [...(gameState.revealedPartnerIds ?? [])];
  let updatedCalledCardSlots = [...(gameState.calledCardSlots ?? [])];

  // Increment play counter for this card type
  const cardTypeId = getCardTypeId(card);
  const newPlayTypeCounters = {
    ...(gameState.playTypeCounters ?? {}),
    [cardTypeId]: ((gameState.playTypeCounters ?? {})[cardTypeId] ?? 0) + 1,
  };
  const newOrdinal = newPlayTypeCounters[cardTypeId];

  // Initialize updatedTeams here so partner reveal can modify it
  let updatedTeams = gameState.teams
    ? { A: { ...gameState.teams.A }, B: { ...gameState.teams.B } }
    : null;

  // Find the first unfilled slot matching typeId + ordinal
  const slotIndex = updatedCalledCardSlots.findIndex(
    (s) => s.typeId === cardTypeId && s.ordinal === newOrdinal && !s.assignedPartnerId && !s.isVoid
  );

  if (slotIndex !== -1) {
    const slot = updatedCalledCardSlots[slotIndex];
    if (playerId === gameState.bidWinnerId) {
      // Bidder played the partner card → void this slot
      updatedCalledCardSlots[slotIndex] = { ...slot, isVoid: true };
    } else if (updatedPartnerIds.includes(playerId)) {
      // Already a partner (deduplication) → void this slot
      updatedCalledCardSlots[slotIndex] = { ...slot, isVoid: true };
    } else {
      // Valid new partner!
      updatedCalledCardSlots[slotIndex] = { ...slot, assignedPartnerId: playerId };
      updatedPartnerIds = [...updatedPartnerIds, playerId];
      updatedRevealedPartnerIds = [...updatedRevealedPartnerIds, playerId];
      partnerRevealed = true;
      revealedPartnerId = playerId;

      // Move player from Team B to Team A
      if (updatedTeams) {
        updatedTeams.A = {
          ...updatedTeams.A,
          playerIds: [...updatedTeams.A.playerIds, playerId],
        };
        updatedTeams.B = {
          ...updatedTeams.B,
          playerIds: updatedTeams.B.playerIds.filter((id) => id !== playerId),
        };
        // Retroactively recalculate team points from all completed tricks
        updatedTeams = recalculateTeamPoints(gameState.completedTricks, updatedTeams);
      }
    }
  }

  const trickComplete = updatedTrick.cards.length === gameState.players.length;

  let newState: GameState;

  if (trickComplete) {
    // 4a. Resolve trick
    const winnerId = resolveTrick(updatedTrick, gameState.trumpSuit, config);
    const resolvedTrick: Trick = { ...updatedTrick, winnerId };
    const completedTricks = [...gameState.completedTricks, resolvedTrick];

    // 4b. Update team stats
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
      newState = {
        ...gameState,
        hands: updatedHands,
        currentTrick: null,
        completedTricks,
        teams: updatedTeams,
        partnerIds: updatedPartnerIds,
        revealedPartnerIds: updatedRevealedPartnerIds,
        calledCardSlots: updatedCalledCardSlots,
        playTypeCounters: newPlayTypeCounters,
        currentTurnPlayerId: null,
      };
    } else {
      const nextTrick = initTrick(completedTricks.length);
      newState = {
        ...gameState,
        hands: updatedHands,
        currentTrick: nextTrick,
        completedTricks,
        teams: updatedTeams,
        partnerIds: updatedPartnerIds,
        revealedPartnerIds: updatedRevealedPartnerIds,
        calledCardSlots: updatedCalledCardSlots,
        playTypeCounters: newPlayTypeCounters,
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
      teams: updatedTeams,
      partnerIds: updatedPartnerIds,
      revealedPartnerIds: updatedRevealedPartnerIds,
      calledCardSlots: updatedCalledCardSlots,
      playTypeCounters: newPlayTypeCounters,
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
