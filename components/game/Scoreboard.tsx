'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import type { Suit, Team, Player } from '@/types';

const SUIT_SYMBOLS: Record<Suit, string> = {
  spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣',
};

interface ScoreboardProps {
  teams: { A: Team; B: Team } | null;
  players: Player[];
  bidWinnerId: string | null;
  bidAmount: number | null;
  trumpSuit: Suit | null;
  roundNumber: number;
  revealedPartnerIds?: string[];
}

export default function Scoreboard({
  teams,
  players,
  bidWinnerId,
  bidAmount,
  trumpSuit,
  roundNumber,
  revealedPartnerIds = [],
}: ScoreboardProps) {
  const [open, setOpen] = useState(false);

  const getPlayerName = (id: string) => players.find((p) => p.id === id)?.name ?? '?';

  const isRed = (s: Suit) => s === 'hearts' || s === 'diamonds';
  const bidWinnerTeam =
    bidWinnerId && teams
      ? teams.A.playerIds.includes(bidWinnerId) ? 'A' : 'B'
      : null;

  /* ── Compact trigger badge ─────────────────────────────────────────────── */
  const teamAScore = teams?.A.totalPoints ?? 0;
  const teamBScore = teams?.B.totalPoints ?? 0;

  return (
    <>
      {/* Trigger button — always visible in top bar */}
      <button
        onClick={() => setOpen(true)}
        className={clsx(
          'flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold transition-colors shrink-0',
          open
            ? 'bg-slate-700 border-slate-500 text-slate-200'
            : 'bg-slate-800/70 border-slate-700 text-slate-300 hover:bg-slate-700/80'
        )}
      >
        {trumpSuit && (
          <span className={clsx('text-sm font-bold', isRed(trumpSuit) ? 'text-red-400' : 'text-slate-200')}>
            {SUIT_SYMBOLS[trumpSuit]}
          </span>
        )}
        <span className="text-sky-400 font-bold">{teamAScore}</span>
        <span className="text-slate-500">vs</span>
        <span className="text-orange-400 font-bold">{teamBScore}</span>
        <span className="ml-0.5 text-slate-500">R{roundNumber}</span>
      </button>

      {/* Slide-in panel */}
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            />

            {/* Panel */}
            <motion.div
              key="panel"
              initial={{ x: '100%', opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '100%', opacity: 0 }}
              transition={{ type: 'spring', stiffness: 340, damping: 32 }}
              className="fixed top-0 right-0 h-screen w-80 max-w-full z-50 bg-slate-900 border-l border-slate-700 shadow-2xl flex flex-col"
            >
              {/* Panel header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/60 shrink-0">
                <div>
                  <h2 className="text-slate-100 font-bold text-base">Scoreboard</h2>
                  <p className="text-slate-500 text-xs">Round {roundNumber}</p>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
                >
                  ✕
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
                {/* Trump + bid info */}
                {(trumpSuit || (bidAmount && bidWinnerId)) && (
                  <div className="rounded-xl bg-slate-800/60 border border-slate-700/50 p-3 space-y-2">
                    {trumpSuit && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-400">Trump Suit</span>
                        <span className={clsx('font-bold text-base', isRed(trumpSuit) ? 'text-red-400' : 'text-slate-100')}>
                          {SUIT_SYMBOLS[trumpSuit]} {trumpSuit.charAt(0).toUpperCase() + trumpSuit.slice(1)}
                        </span>
                      </div>
                    )}
                    {bidAmount && bidWinnerId && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-400">Winning Bid</span>
                        <span className="text-yellow-400 font-bold">{bidAmount} — {getPlayerName(bidWinnerId)}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Teams */}
                {teams ? (
                  <div className="space-y-3">
                    {(['A', 'B'] as const).map((teamId, ti) => {
                      const team = teams[teamId];
                      const isBidTeam = bidWinnerTeam === teamId;
                      const knownPlayerIds = isBidTeam
                        ? team.playerIds.filter(
                            (id) => id === bidWinnerId || revealedPartnerIds.includes(id)
                          )
                        : team.playerIds;
                      const hiddenCount = team.playerIds.length - knownPlayerIds.length;

                      return (
                        <div
                          key={teamId}
                          className={clsx(
                            'rounded-xl border p-3 space-y-2',
                            isBidTeam
                              ? 'border-yellow-500/40 bg-yellow-900/10'
                              : 'border-slate-700/50 bg-slate-800/30'
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {isBidTeam && <span className="text-yellow-400 text-xs">🏆 Bidding</span>}
                              <span className="text-slate-200 font-semibold text-sm">Team {teamId}</span>
                            </div>
                            <div className="flex flex-col items-end">
                              <span className={clsx(
                                'text-lg font-bold',
                                team.totalPoints < 0 ? 'text-red-400' : ti === 0 ? 'text-sky-400' : 'text-orange-400'
                              )}>
                                {team.totalPoints < 0 ? `−${Math.abs(team.totalPoints)}` : team.totalPoints}
                              </span>
                              {isBidTeam && bidAmount && (
                                <span className={clsx(
                                  'text-[10px] font-semibold',
                                  team.roundPoints >= bidAmount ? 'text-green-400' : 'text-red-400'
                                )}>
                                  {team.roundPoints}/{bidAmount} bid
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Players */}
                          <div className="space-y-0.5">
                            {knownPlayerIds.map((id) => (
                              <div key={id} className="flex items-center gap-1.5 text-xs text-slate-300">
                                <span className={clsx('w-1.5 h-1.5 rounded-full shrink-0', ti === 0 ? 'bg-sky-400' : 'bg-orange-400')} />
                                <span className="truncate">{getPlayerName(id)}</span>
                                {id === bidWinnerId && <span className="text-yellow-400 text-[10px]">★ Bid Winner</span>}
                                {revealedPartnerIds.includes(id) && id !== bidWinnerId && (
                                  <span className="text-emerald-400 text-[10px]">✓ Partner</span>
                                )}
                              </div>
                            ))}
                            {hiddenCount > 0 && (
                              <div className="flex items-center gap-1.5 text-xs text-slate-500 italic">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-600 shrink-0" />
                                +{hiddenCount} hidden partner{hiddenCount > 1 ? 's' : ''}
                              </div>
                            )}
                          </div>

                          {/* Stats */}
                          <div className="flex gap-4 pt-1 border-t border-slate-700/40 text-xs">
                            <div>
                              <span className="text-slate-500">Tricks</span>
                              <span className="ml-1.5 font-bold text-slate-200">{team.tricksWon}</span>
                            </div>
                            <div>
                              <span className="text-slate-500">Round pts</span>
                              <span className="ml-1.5 font-bold text-slate-200">{team.roundPoints}</span>
                            </div>
                            <div>
                              <span className="text-slate-500">Cumulative</span>
                              <span className={clsx(
                                'ml-1.5 font-bold',
                                team.totalPoints < 0 ? 'text-red-400' : ti === 0 ? 'text-sky-400' : 'text-orange-400'
                              )}>
                                {team.totalPoints < 0 ? `−${Math.abs(team.totalPoints)}` : team.totalPoints}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-3 py-8">
                    <span className="text-5xl opacity-20">♠</span>
                    <p className="text-slate-400 text-sm text-center font-medium">Bidding in progress</p>
                    <p className="text-slate-600 text-xs text-center">Teams will be revealed after bidding ends</p>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
