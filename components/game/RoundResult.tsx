'use client';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import type { RoundHistory, Team, Player, Suit, TeamId } from '@/types';
import Button from '@/components/ui/Button';

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
        className="absolute inset-0 bg-black/70 backdrop-blur-md"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      />

      <motion.div
        className="relative bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
        initial={{ opacity: 0, scale: 0.88, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 360, damping: 28 }}
      >
        {/* Game Over banner */}
        <AnimatePresence>
          {winnerTeamId && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="bg-gradient-to-r from-yellow-600 via-yellow-500 to-yellow-600 px-6 py-3 text-center"
            >
              <p className="text-yellow-900 font-black text-lg tracking-wide">
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
            <div className="mt-2 flex items-center justify-center gap-3">
              <span
                className={clsx(
                  'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold border',
                  bidMade
                    ? 'border-green-500 bg-green-900/30 text-green-300'
                    : 'border-red-500 bg-red-900/30 text-red-300'
                )}
              >
                {getPlayerName(bidWinnerId)} bid {bidAmount}
                <span className="ml-1">{bidMade ? '✅ BID MADE' : '❌ BID FAILED'}</span>
              </span>
            </div>
          </div>

          {/* Trump & Partners */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="bg-slate-800/60 rounded-lg p-3 border border-slate-700/50">
              <p className="text-xs text-slate-500 mb-1 uppercase tracking-wide">Trump</p>
              <p className={clsx('text-xl font-bold', isRed(trumpSuit) ? 'text-red-400' : 'text-slate-100')}>
                {SUIT_SYMBOLS[trumpSuit]} {trumpSuit.charAt(0).toUpperCase() + trumpSuit.slice(1)}
              </p>
            </div>
            <div className="bg-slate-800/60 rounded-lg p-3 border border-slate-700/50">
              <p className="text-xs text-slate-500 mb-1 uppercase tracking-wide">Partner Cards</p>
              <p className="text-sm font-bold text-slate-200 truncate">
                {partnerCards.length > 0
                  ? partnerCards.map((c) => `${c.rank}${SUIT_SYMBOLS[c.suit]}`).join(', ')
                  : '—'}
              </p>
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
                        isBidTeam ? 'bg-yellow-900/10' : 'bg-slate-800/30'
                      )}
                    >
                      <td className="px-4 py-3">
                        <span className="font-bold text-slate-200">Team {tid}</span>
                        {isBidTeam && (
                          <span className="ml-2 text-[10px] text-yellow-400 font-medium">Bid team</span>
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
                        team.roundPoints > 0 ? 'text-green-400' : 'text-slate-500'
                      )}>
                        {team.roundPoints > 0 ? `+${team.roundPoints}` : team.roundPoints}
                      </td>
                      <td className="text-right px-4 py-3 font-black text-sky-300 text-base">
                        {team.totalPoints}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {winnerTeamId ? (
            <Button size="lg" className="w-full" onClick={onDismiss}>
              Back to Lobby
            </Button>
          ) : isHost ? (
            <Button size="lg" className="w-full" onClick={onStartNextRound}>
              Start Next Round →
            </Button>
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
