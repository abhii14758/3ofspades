import type { Player, GameConfig, BidState } from '@/types';

// ─── Private helpers ─────────────────────────────────────────────────────────

/** Players are sorted by seatIndex for consistent turn order. */
function sortedByseat(players: Player[]): Player[] {
  return [...players].sort((a, b) => a.seatIndex - b.seatIndex);
}

/**
 * Returns the set of playerIds whose LAST bid action was 'pass'.
 * Once a player's final action is 'pass' they are out of the round.
 */
function getPassedPlayerIds(
  bids: Array<{ playerId: string; amount: number | 'pass' }>,
): Set<string> {
  const lastAction = new Map<string, number | 'pass'>();
  for (const bid of bids) {
    lastAction.set(bid.playerId, bid.amount);
  }
  const passed = new Set<string>();
  for (const [id, action] of lastAction) {
    if (action === 'pass') passed.add(id);
  }
  return passed;
}

/** Returns the highest numeric bid placed so far, along with the bidder. */
function getHighestBid(
  bids: Array<{ playerId: string; amount: number | 'pass' }>,
): { amount: number; playerId: string } | null {
  let max = 0;
  let maxId: string | null = null;
  for (const bid of bids) {
    if (typeof bid.amount === 'number' && bid.amount > max) {
      max = bid.amount;
      maxId = bid.playerId;
    }
  }
  return maxId ? { amount: max, playerId: maxId } : null;
}

/** True if the player has placed at least one numeric (non-pass) bid. */
function playerHasBid(
  playerId: string,
  bids: Array<{ playerId: string; amount: number | 'pass' }>,
): boolean {
  return bids.some((b) => b.playerId === playerId && typeof b.amount === 'number');
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Initialises a fresh BidState for the start of a round.
 * Bidding starts with the player immediately to the left of the dealer.
 */
export function initBidState(
  players: Player[],
  dealerIndex: number,
  config: GameConfig,
): BidState {
  const seated = sortedByseat(players);
  const firstIdx = (dealerIndex + 1) % seated.length;
  return {
    currentBid: 0,
    currentBidderId: seated[firstIdx].id,
    bids: [],
    minBid: config.minBid,
    allPassed: false,
    winnerId: null,
  };
}

/**
 * Validates whether a bid action is legal for the given player.
 * Returns `{ valid: true }` or `{ valid: false, error }`.
 */
export function validateBid(
  bidState: BidState,
  playerId: string,
  amount: number | 'pass',
  config: GameConfig,
): { valid: boolean; error?: string } {
  if (bidState.winnerId !== null) {
    return { valid: false, error: 'Bidding is already complete.' };
  }
  if (bidState.currentBidderId !== playerId) {
    return { valid: false, error: 'It is not your turn to bid.' };
  }
  if (amount === 'pass') {
    return { valid: true };
  }
  if (amount < config.minBid) {
    return {
      valid: false,
      error: `Bid must be at least ${config.minBid}.`,
    };
  }
  if (amount % config.bidIncrement !== 0) {
    return {
      valid: false,
      error: `Bid must be a multiple of ${config.bidIncrement}.`,
    };
  }
  if (amount <= bidState.currentBid) {
    return {
      valid: false,
      error: `Bid must exceed the current bid of ${bidState.currentBid}.`,
    };
  }
  return { valid: true };
}

/**
 * Records a bid or pass for the given player and advances the bidding state.
 *
 * Rules applied:
 * - If only 1 active (non-passed) player remains AND they have a bid: they win.
 * - If all players have passed with no numeric bid placed: `allPassed = true`
 *   and `currentBidderId` is set to null so the caller can force the dealer to
 *   bid the minimum.
 * - If all players have passed but someone did place a bid before passing:
 *   the highest bidder wins (edge-case safety net).
 */
export function placeBid(
  bidState: BidState,
  playerId: string,
  amount: number | 'pass',
  players: Player[],
  config: GameConfig,
): BidState {
  const newBids = [...bidState.bids, { playerId, amount }];
  const passedIds = getPassedPlayerIds(newBids);
  const seated = sortedByseat(players);
  const activePlayers = seated.filter((p) => !passedIds.has(p.id));

  // Track current highest bid
  const highBid = getHighestBid(newBids);
  const newCurrentBid = highBid?.amount ?? bidState.currentBid;

  // ── Determine completion state ────────────────────────────────────────────
  if (activePlayers.length === 0) {
    if (highBid) {
      // Someone bid and then later passed — that bidder wins
      return {
        ...bidState,
        bids: newBids,
        currentBid: newCurrentBid,
        currentBidderId: null,
        allPassed: false,
        winnerId: highBid.playerId,
      };
    }
    // Truly all passed with no bids — dealer forced bid handled by caller
    return {
      ...bidState,
      bids: newBids,
      currentBid: newCurrentBid,
      currentBidderId: null,
      allPassed: true,
      winnerId: null,
    };
  }

  if (activePlayers.length === 1) {
    const lastStanding = activePlayers[0];
    if (playerHasBid(lastStanding.id, newBids)) {
      // Only bidder remaining — they win
      return {
        ...bidState,
        bids: newBids,
        currentBid: newCurrentBid,
        currentBidderId: null,
        allPassed: false,
        winnerId: lastStanding.id,
      };
    }
    // Only one player left but they haven't bid yet — advance to them
    return {
      ...bidState,
      bids: newBids,
      currentBid: newCurrentBid,
      currentBidderId: lastStanding.id,
      allPassed: false,
      winnerId: null,
    };
  }

  // Multiple active players remain — advance turn
  const nextId = getNextBidder(
    { ...bidState, bids: newBids },
    playerId,
    players,
  );
  return {
    ...bidState,
    bids: newBids,
    currentBid: newCurrentBid,
    currentBidderId: nextId,
    allPassed: false,
    winnerId: null,
  };
}

/** Returns the winnerId if bidding is complete, otherwise null. */
export function getBidWinner(bidState: BidState): string | null {
  return bidState.winnerId;
}

/**
 * Returns true when bidding has concluded:
 * - exactly 1 non-passed player remains AND they have placed a numeric bid, OR
 * - `winnerId` is already set.
 */
export function isBiddingComplete(
  bidState: BidState,
  players: Player[],
): boolean {
  if (bidState.winnerId !== null) return true;
  if (bidState.allPassed) return false; // caller must force dealer bid first

  const passedIds = getPassedPlayerIds(bidState.bids);
  const activePlayers = players.filter((p) => !passedIds.has(p.id));

  return (
    activePlayers.length === 1 &&
    playerHasBid(activePlayers[0].id, bidState.bids)
  );
}

/**
 * Returns the ID of the next eligible bidder after `currentPlayerId`,
 * skipping anyone who has already passed.
 */
export function getNextBidder(
  bidState: BidState,
  currentPlayerId: string,
  players: Player[],
): string {
  const seated = sortedByseat(players);
  const passedIds = getPassedPlayerIds(bidState.bids);
  const currentIdx = seated.findIndex((p) => p.id === currentPlayerId);

  for (let i = 1; i <= seated.length; i++) {
    const candidate = seated[(currentIdx + i) % seated.length];
    if (!passedIds.has(candidate.id)) {
      return candidate.id;
    }
  }

  // Fallback: return current (should not happen in a valid game)
  return currentPlayerId;
}
