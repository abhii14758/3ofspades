'use client';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import type { RoundHistory, Team, Player, Suit, TeamId } from '@/types';

const SUIT_SYMBOLS: Record<Suit, string> = {
  spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣',
};

interface RoundResultProps {
  roundHistory: RoundHistory;
  teams: { A: Team; B: Team };
  players: Player[];
  winnerTeamId: TeamId | null;
  myPlayerId: string;
  isHost: boolean;
  onStartNextRound: () => void;
  onDismiss: () => void;
}

export default function RoundResult({
  roundHistory,
  teams,
  players,
  winnerTeamId,
  isHost,
  onStartNextRound,
  onDismiss,
}: RoundResultProps) {
  const { roundNumber, bidWinnerId, bidAmount, trumpSuit, partnerCards, bidMade } = roundHistory;

  const getPlayerName = (id: string) => players.find((p) => p.id === id)?.name ?? 'Unknown';
  const isRed = (s: Suit) => s === 'hearts' || s === 'diamonds';

  const bidWinnerTeamId = teams.A.playerIds.includes(bidWinnerId) ? 'A' : 'B';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        className="absolute inset-0 bg-black/80 backdrop-blur-md"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      />

      <motion.div
        className="relative bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
        initial={{ opacity: 0, scale: 0.88, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 360, damping: 28 }}
      >
        {/* Gold top accent line */}
        <div className="absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-amber-500 to-transparent" />

        {/* Game Over banner */}
        <AnimatePresence>
          {winnerTeamId && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="bg-gradient-to-r from-amber-700 via-yellow-500 to-amber-700 px-6 py-3 text-center"
            >
              <p className="text-black font-black text-lg tracking-wide">
                🏆 Team {winnerTeamId} Wins the Game! 🏆
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="p-6">
          {/* Round header */}
          <div className="text-center mb-5">
            <p className="text-slate-400 text-xs uppercase tracking-widest font-semibold">
              Round {roundNumber} Result
            </p>
            <div className="mt-2 flex flex-col items-center gap-1.5">
              <span
                className={clsx(
                  'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border',
                  bidMade
                    ? 'bg-emerald-900/50 border-emerald-600 text-emerald-300'
                    : 'bg-red-900/50 border-red-600 text-red-300'
                )}
              >
                {bidMade ? '✅ BID MADE' : '❌ BID FAILED'}
              </span>
              <p className="text-slate-100 font-bold text-sm">
                {getPlayerName(bidWinnerId)} · bid {bidAmount}
              </p>
            </div>
          </div>

          {/* Trump & Partners */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="bg-slate-800/70 rounded-xl p-3 border border-slate-700/50">
              <p className="text-xs text-slate-500 mb-1 uppercase tracking-wide">Trump</p>
              <p className={clsx('text-2xl font-bold', isRed(trumpSuit) ? 'text-red-400' : 'text-slate-100')}>
                {SUIT_SYMBOLS[trumpSuit]}
                <span className="text-sm ml-1.5 font-semibold">
                  {trumpSuit.charAt(0).toUpperCase() + trumpSuit.slice(1)}
                </span>
              </p>
            </div>
            <div className="bg-slate-800/70 rounded-xl p-3 border border-slate-700/50">
              <p className="text-xs text-slate-500 mb-1 uppercase tracking-wide">Partner Cards</p>
              <div className="flex flex-wrap gap-1 mt-1">
                {partnerCards.length > 0
                  ? partnerCards.map((c, i) => (
                      <span
                        key={i}
                        className={clsx(
                          'text-xs font-bold px-1.5 py-0.5 rounded bg-slate-700/80',
                          isRed(c.suit) ? 'text-red-400' : 'text-slate-200'
                        )}
                      >
                        {c.rank}{SUIT_SYMBOLS[c.suit]}
                      </span>
                    ))
                  : <span className="text-slate-400 text-sm">—</span>}
              </div>
            </div>
          </div>

          {/* Score table */}
          <div className="rounded-xl border border-slate-700/60 overflow-hidden mb-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-800/80 text-slate-400 text-xs uppercase tracking-wide">
                  <th className="text-left px-4 py-2">Team</th>
                  <th className="text-center px-3 py-2">Tricks</th>
                  <th className="text-center px-3 py-2">Round Pts</th>
                  <th className="text-right px-4 py-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {(['A', 'B'] as const).map((tid) => {
                  const team = teams[tid];
                  const isBidTeam = bidWinnerTeamId === tid;
                  return (
                    <tr
                      key={tid}
                      className={clsx(
                        'border-t border-slate-700/40',
                        isBidTeam ? 'bg-amber-900/10' : 'bg-slate-800/30'
                      )}
                    >
                      <td className="px-4 py-3">
                        <span className="font-bold text-slate-200">Team {tid}</span>
                        {isBidTeam && (
                          <span className="ml-2 text-[10px] text-amber-400 font-medium">Bid team</span>
                        )}
                        <div className="text-[10px] text-slate-500 mt-0.5 truncate max-w-[120px]">
                          {team.playerIds.map((id) => getPlayerName(id)).join(', ')}
                        </div>
                      </td>
                      <td className="text-center px-3 py-3 text-slate-300 font-medium">
                        {team.tricksWon}
                      </td>
                      <td className={clsx(
                        'text-center px-3 py-3 font-bold',
                        team.roundPoints > 0 ? 'text-emerald-400' : 'text-red-400'
                      )}>
                        {team.roundPoints > 0 ? `+${team.roundPoints}` : team.roundPoints}
                      </td>
                      <td className={clsx(
                        'text-right px-4 py-3 font-black text-base',
                        tid === 'A' ? 'text-sky-300' : 'text-orange-300'
                      )}>
                        {team.totalPoints}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {winnerTeamId ? (
            <button
              onClick={onDismiss}
              className="w-full bg-slate-700 hover:bg-slate-600 transition-colors text-slate-200 font-bold rounded-xl py-3"
            >
              Back to Lobby
            </button>
          ) : isHost ? (
            <button
              onClick={onStartNextRound}
              className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 transition-all text-white font-bold rounded-xl py-3 shadow-lg shadow-green-900/40"
            >
              Start Next Round →
            </button>
          ) : (
            <p className="text-center text-slate-500 text-sm italic py-2">
              ⏳ Waiting for host to start next round…
            </p>
          )}
        </div>
      </motion.div>
    </div>
  );
}
