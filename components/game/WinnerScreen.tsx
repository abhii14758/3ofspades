'use client';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import type { Team, Player, RoundHistory, Suit } from '@/types';


const SUIT_SYMBOLS: Record<Suit, string> = {
  spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣',
};

interface WinnerScreenProps {
  winnerTeamId: 'A' | 'B';
  teams: { A: Team; B: Team };
  players: Player[];
  roundHistory: RoundHistory[];
  onPlayAgain: () => void;
  onHome: () => void;
}

const CONFETTI_COLORS = [
  'bg-yellow-400', 'bg-sky-400', 'bg-green-400', 'bg-pink-400',
  'bg-purple-400', 'bg-orange-400', 'bg-red-400', 'bg-teal-400',
];

function Confetto({ index }: { index: number }) {
  const color = CONFETTI_COLORS[index % CONFETTI_COLORS.length];
  const left = `${(index * 7.3 + 5) % 98}%`;
  const delay = (index * 0.11) % 2;
  const duration = 2.2 + (index % 5) * 0.4;
  const shape = index % 3 === 0 ? 'rounded-full' : index % 3 === 1 ? 'rounded-none rotate-45' : 'rounded-sm';

  return (
    <motion.div
      className={clsx('absolute top-0 w-2.5 h-2.5', color, shape)}
      style={{ left }}
      initial={{ y: -20, opacity: 1, rotate: 0 }}
      animate={{ y: '110vh', opacity: [1, 1, 0], rotate: 720 }}
      transition={{ duration, delay, ease: 'linear', repeat: Infinity, repeatDelay: delay }}
    />
  );
}

export default function WinnerScreen({
  winnerTeamId,
  teams,
  players,
  roundHistory,
  onPlayAgain,
  onHome,
}: WinnerScreenProps) {
  const winnerTeam = teams[winnerTeamId];
  const loserTeamId = winnerTeamId === 'A' ? 'B' : 'A';
  const loserTeam = teams[loserTeamId];

  const getPlayerName = (id: string) => players.find((p) => p.id === id)?.name ?? '?';
  const getTeamNames = (team: Team) => team.playerIds.map(getPlayerName).join(', ');
  const isRed = (s: Suit) => s === 'hearts' || s === 'diamonds';

  const bidsWon = roundHistory.filter((r) =>
    winnerTeam.playerIds.includes(r.bidWinnerId)
  ).length;

  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex flex-col items-center justify-center overflow-hidden">
      {/* Confetti */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {Array.from({ length: 40 }).map((_, i) => (
          <Confetto key={i} index={i} />
        ))}
      </div>

      <div className="relative z-10 flex flex-col items-center text-center px-6 max-w-2xl w-full">
        {/* Gold radial glow behind trophy */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full bg-amber-500/8 blur-3xl pointer-events-none" />

        {/* Trophy */}
        <motion.div
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 280, damping: 18, delay: 0.1 }}
          className="text-8xl mb-4 drop-shadow-2xl relative z-10"
          style={{ filter: 'drop-shadow(0 0 24px rgba(212,160,23,0.5))' }}
        >
          🏆
        </motion.div>

        {/* Title */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="text-4xl sm:text-5xl font-black mb-2 tracking-tight bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400 bg-clip-text text-transparent"
        >
          Team {winnerTeamId} Wins!
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="text-slate-400 text-base mb-8"
        >
          {getTeamNames(winnerTeam)}
        </motion.p>

        {/* Final score card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="w-full bg-slate-900/80 border border-slate-700 rounded-2xl overflow-hidden mb-6 shadow-2xl"
        >
          <div className="px-5 py-3 bg-slate-800/60 border-b border-slate-700 text-left">
            <p className="text-slate-300 font-bold text-sm">Final Scores</p>
          </div>
          <div className="grid grid-cols-2 divide-x divide-slate-700">
            {(['A', 'B'] as const).map((tid) => {
              const team = teams[tid];
              const isWinner = tid === winnerTeamId;
              return (
                <div
                  key={tid}
                  className={clsx(
                    'px-5 py-4 text-center',
                    isWinner
                      ? 'bg-amber-900/20 border border-amber-600/30'
                      : 'bg-slate-800/40'
                  )}
                >
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide">
                      Team {tid}
                    </p>
                    {isWinner && <span className="text-xs text-amber-400 font-bold">🏆 WINNER</span>}
                  </div>
                  <p className={clsx(
                    'text-3xl font-black',
                    isWinner ? 'text-amber-300' : 'text-slate-400'
                  )}>
                    {team.totalPoints}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1 truncate">{getTeamNames(team)}</p>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Round history summary */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="w-full bg-slate-900/60 border border-slate-700/50 rounded-xl overflow-hidden mb-6"
        >
          <div className="px-4 py-2.5 bg-slate-800/40 border-b border-slate-700/50">
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide">
              {roundHistory.length} Round{roundHistory.length !== 1 ? 's' : ''} Played
            </p>
          </div>
          <div className="max-h-40 overflow-y-auto divide-y divide-slate-700/30">
            {roundHistory.map((rh) => (
              <div key={rh.roundNumber} className="flex items-center justify-between px-4 py-2 text-xs">
                <span className="text-slate-500">R{rh.roundNumber}</span>
                <span className="text-slate-300 font-medium">{getPlayerName(rh.bidWinnerId)}</span>
                <span className="text-yellow-400 font-bold">{rh.bidAmount}</span>
                <span className={clsx(
                  'font-bold',
                  isRed(rh.trumpSuit) ? 'text-red-400' : 'text-slate-200'
                )}>
                  {SUIT_SYMBOLS[rh.trumpSuit]}
                </span>
                <span className={clsx(
                  'font-bold',
                  rh.bidMade ? 'text-green-400' : 'text-red-400'
                )}>
                  {rh.bidMade ? '✅' : '❌'}
                </span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Action buttons */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9 }}
          className="flex gap-3 w-full"
        >
          <button
            onClick={onHome}
            className="flex-1 bg-slate-800/80 hover:bg-slate-700/80 transition-colors border border-slate-600/60 text-slate-300 font-bold rounded-xl py-3 text-sm"
          >
            🏠 Home
          </button>
          <button
            onClick={onPlayAgain}
            className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 transition-all text-white font-bold rounded-xl py-3 text-sm shadow-lg shadow-green-900/40"
          >
            🎮 Play Again
          </button>
        </motion.div>
      </div>
    </div>
  );
}
