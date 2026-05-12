'use client';
import { useState } from 'react';
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative bg-slate-900/98 border border-amber-700/40 rounded-2xl shadow-2xl shadow-black/60 p-5 w-full max-w-sm backdrop-blur overflow-hidden"
    >
      {/* Gold top accent line */}
      <div className="absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-amber-500 to-transparent rounded-t-2xl" />
      {/* Current bid banner */}
      <div className="text-center mb-3">
        <p className="text-slate-400 text-[10px] uppercase tracking-widest font-semibold">
          Current Highest Bid
        </p>
        {currentBid > 0 ? (
          <p className="text-5xl font-black text-amber-400 mt-0.5">{currentBid}</p>
        ) : (
          <p className="text-lg text-slate-500 mt-0.5 italic">No bids yet</p>
        )}
        {bidState.currentBidderId && currentBid > 0 && (
          <p className="text-sm text-slate-400 mt-0.5">
            by <span className="text-slate-200 font-medium">{getPlayerName(bidState.currentBidderId)}</span>
          </p>
        )}
      </div>

      {/* Bid history */}
      <div className="mb-3 max-h-28 overflow-y-auto rounded-xl bg-slate-800/70 border border-slate-700/40 divide-y divide-slate-700/30 scroll-smooth">
        {bids.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-2">No bids placed yet</p>
        ) : (
          [...bids].reverse().map((b, i) => (
            <div key={i} className="flex items-center justify-between text-xs px-2 py-1">
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
        <>
          {/* Quick bid buttons — dynamic, no arrows */}
          <div className="grid grid-cols-3 gap-2 mb-2">
            {quickBids.slice(0, 2).map((amount) => (
              <button
                key={amount}
                onClick={() => onBid(amount)}
                className="py-2.5 rounded-xl bg-sky-900/60 border border-sky-700/60 text-sky-300 hover:bg-sky-800/80 font-bold text-sm transition-colors"
              >
                {amount}
              </button>
            ))}
            {quickBids.slice(2, 4).map((amount) => (
              <button
                key={amount}
                onClick={() => onBid(amount)}
                className="py-2.5 rounded-xl bg-indigo-900/60 border border-indigo-700/60 text-indigo-300 hover:bg-indigo-800/80 font-bold text-sm transition-colors"
              >
                {amount}
              </button>
            ))}
            {nextMin <= maxBid && quickBids.length > 0 && (
              <button
                onClick={() => onBid(maxBid)}
                className="py-2.5 rounded-xl bg-purple-900/60 border border-purple-600/60 text-purple-300 hover:bg-purple-800/80 font-bold text-sm transition-colors"
              >
                MAX {maxBid}
              </button>
            )}
          </div>

          {/* Pass button */}
          <button
            onClick={onPass}
            className="w-full mt-3 py-3 bg-red-900/60 hover:bg-red-800/70 border border-red-700/60 text-red-300 rounded-xl font-bold text-sm transition-colors"
          >
            Pass
          </button>
        </>
      )}

      {!isMyTurn && (
        <motion.p
          animate={{ opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="text-center text-slate-400 text-sm italic mt-2"
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
