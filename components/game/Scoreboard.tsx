'use client';
import { useEffect, useState } from 'react';
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
  playerTotals?: Record<string, number>;
}

export default function Scoreboard({
  teams,
  players,
  bidWinnerId,
  bidAmount,
  trumpSuit,
  roundNumber,
  revealedPartnerIds = [],
  playerTotals = {},
}: ScoreboardProps) {
  const [open, setOpen] = useState(false);

  // Detect mobile portrait for bottom-sheet vs side-panel
  const [isMobileSheet, setIsMobileSheet] = useState(false);
  useEffect(() => {
    const check = () => setIsMobileSheet(window.innerWidth < 640);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const getPlayerName = (id: string) => players.find((p) => p.id === id)?.name ?? '?';

  const isRed = (s: Suit) => s === 'hearts' || s === 'diamonds';
  const bidWinnerTeam =
    bidWinnerId && teams
      ? teams.A.playerIds.includes(bidWinnerId) ? 'A' : 'B'
      : null;

  const teamAScore = teams?.A.totalPoints ?? 0;
  const teamBScore = teams?.B.totalPoints ?? 0;

  return (
    <>
      {/* Trigger button — always visible in top bar */}
      <button
        onClick={() => setOpen(true)}
        className={clsx(
          'flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold transition-all shrink-0',
          open
            ? 'bg-slate-700 border-slate-500 text-slate-200 border-l-2 border-l-amber-500/70'
            : 'bg-slate-800/70 border-slate-700 text-slate-300 hover:bg-slate-700/80 hover:shadow-[0_0_8px_rgba(212,160,23,0.25)]'
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

            {/* Panel — bottom sheet on mobile, right panel on desktop */}
            <motion.div
              key="panel"
              initial={isMobileSheet ? { y: '100%' } : { x: '100%' }}
              animate={isMobileSheet ? { y: 0 } : { x: 0 }}
              exit={isMobileSheet ? { y: '100%' } : { x: '100%' }}
              transition={{ type: 'spring', stiffness: 340, damping: 32 }}
              className={clsx(
                'fixed z-50 bg-slate-900 border-slate-700 shadow-2xl flex flex-col overflow-hidden',
                // Mobile: bottom sheet
                'inset-x-0 bottom-0 max-h-[80vh] rounded-t-2xl border-t',
                // Desktop: right side panel
                'sm:inset-x-auto sm:bottom-auto sm:top-0 sm:right-0 sm:h-screen sm:max-h-full sm:w-80 sm:rounded-none sm:border-t-0 sm:border-l',
              )}
            >
              {/* Gold accent */}
              <div className="absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-amber-500/60 to-transparent" />

              {/* Drag handle (mobile only) */}
              <div className="flex justify-center pt-2.5 pb-1 sm:hidden">
                <div className="w-10 h-1 rounded-full bg-slate-600" />
              </div>

              {/* Panel header */}
              <div className="flex items-center justify-between px-5 py-3 sm:py-4 border-b border-slate-700/60 shrink-0">
                <div>
                  <h2 className="text-slate-100 font-bold text-base">Scoreboard</h2>
                  <p className="text-amber-400/80 text-xs">Round {roundNumber}</p>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="w-9 h-9 flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors touch-manipulation"
                >
                  ✕
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0" style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>
                {/* Top 3 leaderboard */}
                {Object.keys(playerTotals).length > 0 && (() => {
                  const top3 = [...players]
                    .filter(p => playerTotals[p.id] !== undefined)
                    .sort((a, b) => (playerTotals[b.id] ?? 0) - (playerTotals[a.id] ?? 0))
                    .slice(0, 3);
                  if (top3.length === 0) return null;
                  return (
                    <div className="rounded-xl bg-slate-800/50 border border-slate-700/40 p-3">
                      <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-2">Top Players</p>
                      <div className="space-y-1.5">
                        {top3.map((p, i) => (
                          <div key={p.id} className="flex items-center gap-2 text-xs">
                            <span className="w-5 text-center shrink-0">{i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}</span>
                            <span className="flex-1 truncate text-slate-300">{p.name}</span>
                            <span className={clsx('font-black tabular-nums shrink-0', i === 0 ? 'text-amber-400' : 'text-slate-300')}>
                              {playerTotals[p.id] ?? 0}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Trump + bid info */}
                {(trumpSuit || (bidAmount && bidWinnerId)) && (
                  <div className="rounded-xl bg-slate-800/70 border border-amber-700/20 p-3 space-y-2">
                    {trumpSuit && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-400">Trump Suit</span>
                        <span className={clsx('font-bold text-xl', isRed(trumpSuit) ? 'text-red-400' : 'text-slate-100')}>
                          {SUIT_SYMBOLS[trumpSuit]} <span className="text-sm">{trumpSuit.charAt(0).toUpperCase() + trumpSuit.slice(1)}</span>
                        </span>
                      </div>
                    )}
                    {bidAmount && bidWinnerId && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-400">Winning Bid</span>
                        <span className="text-amber-400 font-bold">{bidAmount} — {getPlayerName(bidWinnerId)}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Teams with per-player scores */}
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
                              ? 'border-amber-600/40 bg-amber-900/10'
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
                                'text-xs font-bold',
                                ti === 0 ? 'text-sky-400/70' : 'text-orange-400/70'
                              )}>
                                {team.roundPoints} round pts
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

                          {/* Per-player scores */}
                          <div className="space-y-1">
                            {knownPlayerIds.map((id) => {
                              const total = playerTotals[id] ?? 0;
                              return (
                                <div key={id} className="flex items-center justify-between text-xs">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <span className={clsx('w-1.5 h-1.5 rounded-full shrink-0', ti === 0 ? 'bg-sky-400' : 'bg-orange-400')} />
                                    <span className="truncate text-slate-300">{getPlayerName(id)}</span>
                                    {id === bidWinnerId && <span className="text-yellow-400 text-[9px] shrink-0">★</span>}
                                    {revealedPartnerIds.includes(id) && id !== bidWinnerId && (
                                      <span className="text-emerald-400 text-[9px] shrink-0">✓</span>
                                    )}
                                  </div>
                                  <span className={clsx(
                                    'font-black text-sm tabular-nums shrink-0 ml-2',
                                    total > 0 ? (ti === 0 ? 'text-sky-300' : 'text-orange-300') : total < 0 ? 'text-red-400' : 'text-slate-500'
                                  )}>
                                    {total > 0 ? total : total < 0 ? `−${Math.abs(total)}` : '0'}
                                  </span>
                                </div>
                              );
                            })}
                            {hiddenCount > 0 && (
                              <div className="flex items-center gap-1.5 text-xs text-slate-500 italic">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-600 shrink-0" />
                                +{hiddenCount} hidden partner{hiddenCount > 1 ? 's' : ''}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-3 py-8">
                    <span className="text-5xl opacity-30">♠</span>
                    <p className="text-slate-300 text-sm text-center font-semibold">Bidding in progress</p>
                    <p className="text-slate-500 text-xs text-center">Teams will be revealed after bidding ends</p>
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
