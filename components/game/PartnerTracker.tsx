'use client';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import type { CalledCardSlot, Player, Suit } from '@/types';

const SUIT_SYMBOLS: Record<Suit, string> = {
  spades: '♠',
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
};

interface PartnerTrackerProps {
  slots: CalledCardSlot[];
  players: Player[];
  bidWinnerId: string;
}

function formatTypeId(typeId: string): { rank: string; suit: Suit; symbol: string; isRed: boolean } {
  const parts = typeId.split('_');
  const suit = parts[0] as Suit;
  const rank = parts.slice(1).join('_');
  const symbol = SUIT_SYMBOLS[suit] ?? '?';
  const isRed = suit === 'hearts' || suit === 'diamonds';
  return { rank, suit, symbol, isRed };
}

export default function PartnerTracker({ slots, players, bidWinnerId, inline = false }: PartnerTrackerProps & { inline?: boolean }) {
  void bidWinnerId;
  if (slots.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className={inline
        ? 'bg-slate-900/90 border border-slate-700 rounded-xl p-2 shadow-xl min-w-[120px] max-w-[160px]'
        : 'absolute top-2 right-2 z-30 bg-slate-900/90 border border-slate-700 rounded-xl p-2 shadow-xl min-w-[120px] max-w-[160px]'}
    >
      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 px-0.5">
        Partner Slots
      </div>
      <div className="space-y-1">
        {slots.map((slot, i) => {
          const { rank, symbol, isRed } = formatTypeId(slot.typeId);
          const partnerPlayer = slot.assignedPartnerId
            ? players.find(p => p.id === slot.assignedPartnerId)
            : null;

          return (
            <div
              key={i}
              className={clsx(
                'flex items-center gap-1.5 px-1.5 py-1 rounded-lg text-[11px]',
                slot.isVoid
                  ? 'bg-red-950/40 border border-red-800/50'
                  : slot.assignedPartnerId
                    ? 'bg-emerald-950/40 border border-emerald-700/50'
                    : 'bg-slate-800/60 border border-slate-700/50'
              )}
            >
              {/* Status dot */}
              <div className={clsx(
                'w-1.5 h-1.5 rounded-full flex-shrink-0',
                slot.isVoid ? 'bg-red-500' : slot.assignedPartnerId ? 'bg-emerald-400' : 'bg-blue-400'
              )} />

              {/* Card display */}
              <span className={clsx(
                'font-black',
                slot.isVoid ? 'line-through text-slate-500' : isRed ? 'text-red-400' : 'text-slate-200'
              )}>
                {rank}{symbol}
              </span>

              {/* Ordinal badge */}
              <span className="text-[9px] text-slate-500 font-semibold">
                {slot.ordinal === 1 ? '1st' : '2nd'}
              </span>

              {/* Status text */}
              <span className={clsx(
                'ml-auto text-[9px] font-semibold',
                slot.isVoid ? 'text-red-400' : slot.assignedPartnerId ? 'text-emerald-400' : 'text-blue-400'
              )}>
                {slot.isVoid
                  ? 'Void'
                  : partnerPlayer
                    ? partnerPlayer.name.slice(0, 8)
                    : '…'}
              </span>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
