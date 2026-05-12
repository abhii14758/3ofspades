import type { Player } from '@/types';

/** Returns players sorted ascending by seatIndex. */
function sortedByseat(players: Player[]): Player[] {
  return [...players].sort((a, b) => a.seatIndex - b.seatIndex);
}

/**
 * Returns the ID of the next active (non-disconnected) player in seat order
 * after `currentPlayerId`, wrapping around circularly.
 */
export function getNextPlayer(
  currentPlayerId: string,
  players: Player[],
): string {
  const seated = sortedByseat(players);
  const activeSeated = seated.filter((p) => p.status !== 'disconnected');
  const currentIdx = activeSeated.findIndex((p) => p.id === currentPlayerId);

  if (currentIdx === -1 || activeSeated.length === 0) {
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
