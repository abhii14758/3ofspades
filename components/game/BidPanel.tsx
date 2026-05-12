'use client';
import { useState } from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import type { BidState, Player } from '@/types';
import Button from '@/components/ui/Button';

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
      className="bg-slate-900/97 border border-slate-700 rounded-2xl shadow-2xl p-4 w-full max-w-sm"
    >
      {/* Current bid banner */}
      <div className="text-center mb-3">
        <p className="text-slate-400 text-[10px] uppercase tracking-widest font-semibold">
          Current Highest Bid
        </p>
        {currentBid > 0 ? (
          <p className="text-4xl font-bold text-yellow-400 mt-0.5">{currentBid}</p>
        ) : (
          <p className="text-lg text-slate-500 mt-0.5 italic">No bids yet</p>
        )}
        {bidState.currentBidderId && currentBid > 0 && (
          <p className="text-xs text-slate-400 mt-0.5">
            by <span className="text-slate-200 font-medium">{getPlayerName(bidState.currentBidderId)}</span>
          </p>
        )}
      </div>

      {/* Bid history */}
      <div className="mb-3 max-h-24 overflow-y-auto rounded-lg bg-slate-800/60 border border-slate-700/50 p-2 space-y-0.5 scroll-smooth">
        {bids.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-1">No bids placed yet</p>
        ) : (
          [...bids].reverse().map((b, i) => (
            <div key={i} className="flex items-center justify-between text-xs px-1 py-0.5">
              <span className={clsx('font-medium', b.playerId === myPlayerId ? 'text-sky-300' : 'text-slate-300')}>
                {getPlayerName(b.playerId)}
              </span>
              {b.amount === 'pass' ? (
                <span className="text-slate-500 italic text-[11px]">passed</span>
              ) : (
                <span className="text-yellow-400 font-bold">{b.amount}</span>
              )}
            </div>
          ))
        )}
      </div>

      {isMyTurn && (
        <>
          {/* Quick bid buttons — dynamic, no arrows */}
          <div className="grid grid-cols-3 gap-1.5 mb-2">
            {quickBids.slice(0, 3).map((amount) => (
              <button
                key={amount}
                onClick={() => onBid(amount)}
                className="py-2.5 rounded-xl bg-sky-700 hover:bg-sky-600 active:bg-sky-800 text-white font-bold text-sm transition-colors border border-sky-600 shadow-sm"
              >
                {amount}
              </button>
            ))}
            {quickBids.slice(3, 5).map((amount) => (
              <button
                key={amount}
                onClick={() => onBid(amount)}
                className="py-2.5 rounded-xl bg-indigo-700 hover:bg-indigo-600 active:bg-indigo-800 text-white font-bold text-sm transition-colors border border-indigo-600 shadow-sm"
              >
                {amount}
              </button>
            ))}
            {nextMin <= maxBid && quickBids.length > 0 && (
              <button
                onClick={() => onBid(maxBid)}
                className="py-2.5 rounded-xl bg-purple-700 hover:bg-purple-600 text-white font-bold text-sm transition-colors border border-purple-600 shadow-sm"
              >
                MAX {maxBid}
              </button>
            )}
          </div>

          {/* Pass button */}
          <Button variant="danger" size="md" className="w-full mt-1" onClick={onPass}>
            Pass
          </Button>
        </>
      )}

      {!isMyTurn && (
        <p className="text-center text-slate-500 text-sm italic mt-2">
          Waiting for{' '}
          <span className="text-slate-300">
            {bidState.currentBidderId ? getPlayerName(bidState.currentBidderId) : 'player'}
          </span>{' '}
          to bid…
        </p>
      )}
    </motion.div>
  );
}
