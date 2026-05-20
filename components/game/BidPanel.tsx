'use client';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import type { BidState, Player } from '@/types';

interface BidPanelProps {
  bidState: BidState;
  players: Player[];
  myPlayerId: string;
  isMyTurn: boolean;
  onBid: (amount: number) => void;
  onPass: () => void;
  maxBid?: number; // defaults to totalRoundPoints (250 or 500)
}

export default function BidPanel({
  bidState,
  players,
  myPlayerId,
  isMyTurn,
  onBid,
  onPass,
  maxBid = 250,
}: BidPanelProps) {
  const { currentBid, bids, minBid } = bidState;

  const nextMin = Math.max(
    (currentBid > 0 ? currentBid : 0) + 10,
    minBid,
  );

  // Dynamic quick bid options — all valid steps from nextMin up to maxBid
  const quickBids: number[] = [];
  for (let v = nextMin; v <= maxBid && quickBids.length < 5; v += 10) {
    quickBids.push(v);
  }

  const getPlayerName = (id: string) => players.find((p) => p.id === id)?.name ?? 'Unknown';

  // Detect mobile portrait (<640px) for bottom-sheet slide animation
  const [isMobileSheet, setIsMobileSheet] = useState(false);
  useEffect(() => {
    const check = () => setIsMobileSheet(window.innerWidth < 640);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  return (
    <motion.div
      initial={isMobileSheet ? { y: 80, opacity: 0 } : { opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 340, damping: 32 }}
      className={clsx(
        'relative w-full overflow-hidden',
        'bg-slate-900/98 border border-amber-700/40 backdrop-blur-sm',
        // Mobile: flat bottom (flush to screen edge), Desktop: fully rounded
        'rounded-t-2xl sm:rounded-2xl',
        'shadow-[0_-8px_40px_rgba(0,0,0,0.6)] sm:shadow-2xl sm:shadow-black/60',
      )}
    >
      {/* Gold top accent line */}
      <div className="absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-amber-500 to-transparent" />

      {/* Drag handle — mobile visual affordance */}
      <div className="flex justify-center pt-2.5 pb-0.5 sm:hidden">
        <div className="w-10 h-1 rounded-full bg-slate-600" />
      </div>

      {/* Current bid banner */}
      <div className="text-center px-4 pt-3 sm:pt-5 pb-2 sm:pb-3">
        <p className="text-slate-400 text-[10px] uppercase tracking-widest font-semibold">
          Current Highest Bid
        </p>
        {currentBid > 0 ? (
          <p className="text-4xl sm:text-5xl font-black text-amber-400 mt-0.5 leading-none">{currentBid}</p>
        ) : (
          <p className="text-base text-slate-500 mt-0.5 italic">No bids yet</p>
        )}
        {bidState.currentBidderId && currentBid > 0 && (
          <p className="text-xs text-slate-400 mt-0.5">
            by <span className="text-slate-200 font-medium">{getPlayerName(bidState.currentBidderId)}</span>
          </p>
        )}
      </div>

      {/* Bid history */}
      <div className="mx-4 mb-3 max-h-32 sm:max-h-40 overflow-y-auto rounded-xl bg-slate-800/70 border border-slate-700/40 divide-y divide-slate-700/30 scroll-smooth" style={{ touchAction: 'pan-y' }}>
        {bids.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-2">No bids placed yet</p>
        ) : (
          [...bids].reverse().map((b, i) => (
            <div key={i} className="flex items-center justify-between text-xs px-3 py-1.5">
              <span className={clsx('font-medium', b.playerId === myPlayerId ? 'text-sky-300' : 'text-slate-300')}>
                {getPlayerName(b.playerId)}
              </span>
              {b.amount === 'pass' ? (
                <span className="text-slate-500 italic text-[11px]">passed</span>
              ) : (
                <span className="text-amber-400 font-bold">{b.amount}</span>
              )}
            </div>
          ))
        )}
      </div>

      {isMyTurn && (
        <div className="px-4 pb-4 space-y-2" style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>
          {/* Quick bid buttons — 5 in a row, auto-sized */}
          <div className="flex gap-1.5">
            {quickBids.map((amount, idx) => {
              const isMax = amount === maxBid;
              return (
                <button
                  key={amount}
                  onClick={() => onBid(amount)}
                  className={clsx(
                    'flex-1 min-w-0 py-3 rounded-xl font-bold text-sm transition-colors touch-manipulation',
                    isMax
                      ? 'bg-purple-900/60 border border-purple-600/60 text-purple-300 hover:bg-purple-800/80 active:bg-purple-700/80'
                      : idx < 2
                        ? 'bg-sky-900/60 border border-sky-700/60 text-sky-300 hover:bg-sky-800/80 active:bg-sky-700/80'
                        : 'bg-indigo-900/60 border border-indigo-700/60 text-indigo-300 hover:bg-indigo-800/80 active:bg-indigo-700/80'
                  )}
                >
                  {amount}
                </button>
              );
            })}
          </div>

          {/* Pass button */}
          <button
            onClick={onPass}
            className="w-full py-3 bg-red-900/60 hover:bg-red-800/70 active:bg-red-700/70 border border-red-700/60 text-red-300 rounded-xl font-bold text-sm transition-colors touch-manipulation"
          >
            Pass
          </button>
        </div>
      )}

      {!isMyTurn && (
        <motion.p
          animate={{ opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="text-center text-slate-400 text-sm italic px-4 pb-4"
          style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
        >
          ⏳ Waiting for{' '}
          <span className="text-amber-400 not-italic font-semibold">
            {bidState.currentBidderId ? getPlayerName(bidState.currentBidderId) : 'player'}
          </span>{' '}
          to bid…
        </motion.p>
      )}
    </motion.div>
  );
}

