import type { Trick, Team, TeamId, GameConfig } from '@/types';
import { getTrickPoints } from './trickEngine';

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Creates the initial teams for a round.
 *
 * - Team A: bid winner + partners (players holding called cards)
 * - Team B: remaining players
 *
 * `totalPoints` is initialised to 0; callers should restore previous-round
 * totals after calling this function.
 */
export function createInitialTeams(
  bidWinnerId: string,
  partnerIds: string[],
  allPlayerIds: string[],
): { A: Team; B: Team } {
  const teamAIds = [bidWinnerId, ...partnerIds.filter((id) => id !== bidWinnerId)];
  const teamBIds = allPlayerIds.filter((id) => !teamAIds.includes(id));

  return {
    A: { id: 'A', playerIds: teamAIds, tricksWon: 0, roundPoints: 0, totalPoints: 0 },
    B: { id: 'B', playerIds: teamBIds, tricksWon: 0, roundPoints: 0, totalPoints: 0 },
  };
}

/**
 * Distributes each completed trick's points to the team whose player won it.
 * Resets `tricksWon` and `roundPoints` before recalculating (idempotent).
 */
export function assignTricksToTeams(
  completedTricks: Trick[],
  teams: { A: Team; B: Team },
): { A: Team; B: Team } {
  const teamA: Team = { ...teams.A, tricksWon: 0, roundPoints: 0 };
  const teamB: Team = { ...teams.B, tricksWon: 0, roundPoints: 0 };

  for (const trick of completedTricks) {
    if (!trick.winnerId) continue;
    const pts = getTrickPoints(trick);
    if (teamA.playerIds.includes(trick.winnerId)) {
      teamA.tricksWon++;
      teamA.roundPoints += pts;
    } else {
      teamB.tricksWon++;
      teamB.roundPoints += pts;
    }
  }

  return { A: teamA, B: teamB };
}

/**
 * Calculates and applies end-of-round scoring:
 *
 * - Bid made (bid team's roundPoints ≥ bidAmount):
 *     bid team   → totalPoints += roundPoints
 *     other team → totalPoints += roundPoints
 * - Bid failed:
 *     bid team   → totalPoints -= bidAmount  (lose the full bid)
 *     other team → totalPoints += roundPoints + bidAmount  (bonus)
 *
 * Returns updated teams and a `bidMade` flag.
 */
export function calculateRoundScore(
  completedTricks: Trick[],
  teams: { A: Team; B: Team },
  bidWinnerId: string,
  bidAmount: number,
  config: GameConfig,
): { A: Team; B: Team; bidMade: boolean } {
  const { A: teamA, B: teamB } = assignTricksToTeams(completedTricks, teams);

  // Carry over accumulated totals from previous rounds
  teamA.totalPoints = teams.A.totalPoints;
  teamB.totalPoints = teams.B.totalPoints;

  const bidTeamIsA = teamA.playerIds.includes(bidWinnerId);
  const bidTeam = bidTeamIsA ? teamA : teamB;
  const otherTeam = bidTeamIsA ? teamB : teamA;

  const bidMade = bidTeam.roundPoints >= bidAmount;

  if (bidMade) {
    bidTeam.totalPoints += bidTeam.roundPoints;
    otherTeam.totalPoints += otherTeam.roundPoints;
  } else {
    bidTeam.totalPoints -= bidAmount;
    otherTeam.totalPoints += otherTeam.roundPoints + bidAmount;
  }

  return { A: teamA, B: teamB, bidMade };
}

/**
 * Returns the TeamId of the first team whose `totalPoints` reaches or exceeds
 * `config.winningScore`, or null if neither team has won yet.
 */
export function checkGameWinner(
  teams: { A: Team; B: Team },
  config: GameConfig,
): TeamId | null {
  if (teams.A.totalPoints >= config.winningScore) return 'A';
  if (teams.B.totalPoints >= config.winningScore) return 'B';
  return null;
}
