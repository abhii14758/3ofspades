import type { Player } from '@/types';

/** Returns players sorted ascending by seatIndex. */
function sortedByseat(players: Player[]): Player[] {
  return [...players].sort((a, b) => a.seatIndex - b.seatIndex);
}

/**
 * Returns the ID of the next player in seat order after `currentPlayerId`,
 * wrapping around circularly.
 *
 * All players — including substituted bots that carry status='disconnected' —
 * stay in the rotation so that bot auto-play can cover their turns.
 * Only truly disconnected *humans* (not yet substituted) are skipped.
 */
export function getNextPlayer(
  currentPlayerId: string,
  players: Player[],
): string {
  const seated = sortedByseat(players);
  // Bots (including substituted-disconnected bots) are always active.
  // Only skip human players that are disconnected without a bot substitution.
  const activeSeated = seated.filter(
    (p) => p.type === 'bot' || p.status !== 'disconnected',
  );
  const currentIdx = activeSeated.findIndex((p) => p.id === currentPlayerId);

  if (currentIdx === -1 || activeSeated.length === 0) {
    // Fallback: if current player isn't in activeSeated (shouldn't happen
    // post-substitution), try to find them in full seated list and advance.
    const allIdx = seated.findIndex((p) => p.id === currentPlayerId);
    if (allIdx !== -1 && seated.length > 1) {
      for (let i = 1; i <= seated.length; i++) {
        const candidate = seated[(allIdx + i) % seated.length];
        if (candidate.type === 'bot' || candidate.status !== 'disconnected') {
          return candidate.id;
        }
      }
    }
    return players[0]?.id ?? currentPlayerId;
  }

  return activeSeated[(currentIdx + 1) % activeSeated.length].id;
}

/** Returns the player at the given seatIndex, or undefined if none. */
export function getPlayerBySeatIndex(
  players: Player[],
  seatIndex: number,
): Player | undefined {
  return players.find((p) => p.seatIndex === seatIndex);
}

/**
 * Returns the player immediately to the left of the dealer
 * (i.e., at `(dealerIndex + 1) % players.length` in seat order).
 */
export function getPlayerToLeftOfDealer(
  players: Player[],
  dealerIndex: number,
): Player {
  const seated = sortedByseat(players);
  return seated[(dealerIndex + 1) % seated.length];
}

/**
 * Advances the dealer clockwise by one seat.
 * Returns the new dealerIndex (0-based index into seat-sorted player array).
 */
export function getNextDealer(
  players: Player[],
  currentDealerIndex: number,
): number {
  return (currentDealerIndex + 1) % players.length;
}

/**
 * Returns all players in turn order starting from (and including) `startPlayerId`,
 * cycling through the seat-sorted array.
 */
export function getTurnOrder(players: Player[], startPlayerId: string): Player[] {
  const seated = sortedByseat(players);
  const startIdx = seated.findIndex((p) => p.id === startPlayerId);
  if (startIdx === -1) return seated;

  return [
    ...seated.slice(startIdx),
    ...seated.slice(0, startIdx),
  ];
}
