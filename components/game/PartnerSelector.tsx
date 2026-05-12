'use client';
import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import type { Suit, Rank, Card as CardType } from '@/types';

const SUIT_SYMBOLS: Record<Suit, string> = {
  spades: '♠',
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
};

const SUIT_LABELS: Record<Suit, string> = {
  spades: 'Spades',
  hearts: 'Hearts',
  diamonds: 'Diamonds',
  clubs: 'Clubs',
};

const ALL_SUITS: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];
const ALL_RANKS: Rank[] = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

const CARD_POINTS: Record<Rank, number> = {
  '3': 0, '4': 0, '5': 0, '6': 0, '7': 0, '8': 0,
  '9': 0, '10': 10, 'J': 2, 'Q': 3, 'K': 4, 'A': 11,
};

function makeAllCards(): CardType[] {
  return ALL_SUITS.flatMap((suit) =>
    ALL_RANKS.map((rank) => ({ id: `${suit}_${rank}`, suit, rank, points: CARD_POINTS[rank] }))
  );
}

interface PartnerSelectorProps {
  onSelect: (cardIds: string[]) => void;
  trumpSuit: Suit;
  myHand: CardType[];
  partnerCount?: number; // default 2
}

/** Normalise a card ID to its canonical type ID (strips _0/_1 double-deck suffix). */
function toTypeId(cardId: string): string {
  // IDs are suit_rank (single deck) or suit_rank_0/suit_rank_1 (double deck).
  // The suit name is the part before the first '_', the rank is next (1-2 chars),
  // so we split and take the first two segments.
  const parts = cardId.split('_');
  if (parts.length <= 2) return cardId; // already a type ID
  // Handle ranks that contain digits vs letter ranks:
  // spades_10_0 → ['spades','10','0'] → 'spades_10'
  // spades_A_0  → ['spades','A','0']  → 'spades_A'
  return `${parts[0]}_${parts[1]}`;
}

export default function PartnerSelector({
  onSelect,
  trumpSuit,
  myHand,
  partnerCount = 2,
}: PartnerSelectorProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  // Normalise hand card IDs to type IDs so double-deck cards still match
  const myHandTypeIds = useMemo(() => new Set(myHand.map((c) => toTypeId(c.id))), [myHand]);

  const toggle = (cardId: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(cardId)) return prev.filter((id) => id !== cardId);
      if (prev.length >= partnerCount) return [...prev.slice(1), cardId];
      return [...prev, cardId];
    });
  };

  const isRed = (suit: Suit) => suit === 'hearts' || suit === 'diamonds';

  const isComplete = selectedIds.length === partnerCount;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <motion.div
        className="relative bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 28 }}
      >
        {/* Gold accent strip */}
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-amber-500 to-transparent" />

        {/* Header */}
        <div className="px-6 pt-7 pb-4 border-b border-slate-700 sticky top-0 bg-slate-900 z-10">
          <h2 className="text-xl font-black text-slate-100">
            Select Partner Card{partnerCount !== 1 ? 's' : ''}
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Choose {partnerCount} secret partner card{partnerCount !== 1 ? 's' : ''}
          </p>
          <div className="flex items-center gap-3 mt-3">
            <div
              className={clsx(
                'text-sm font-bold px-3 py-1 rounded-full border',
                isComplete
                  ? 'bg-emerald-900/60 border-emerald-600 text-emerald-300'
                  : 'bg-slate-800 border-slate-600 text-slate-400'
              )}
            >
              {selectedIds.length}/{partnerCount} selected
            </div>
            <div className="text-xs text-slate-500">
              Trump:{' '}
              <span className={clsx('font-bold', isRed(trumpSuit) ? 'text-red-400' : 'text-slate-200')}>
                {SUIT_SYMBOLS[trumpSuit]} {SUIT_LABELS[trumpSuit]}
              </span>
            </div>
          </div>
        </div>

        {/* Card grid by suit */}
        <div className="p-4 space-y-5">
          {ALL_SUITS.map((suit) => (
            <div key={suit}>
              {/* Suit section header */}
              <div className={clsx(
                'flex items-center gap-2 mb-3',
                isRed(suit) ? 'text-red-400' : 'text-slate-200'
              )}>
                <span className="text-xl">{SUIT_SYMBOLS[suit]}</span>
                <span className="text-base font-bold">{SUIT_LABELS[suit]}</span>
                <span className="text-xs text-slate-500">({ALL_RANKS.length} cards)</span>
                {suit === trumpSuit && (
                  <span className="text-[10px] bg-yellow-500 text-yellow-900 px-1.5 py-0.5 rounded font-bold">
                    TRUMP
                  </span>
                )}
              </div>

              {/* Cards */}
              <div className="flex flex-wrap gap-1.5">
                {ALL_RANKS.map((rank) => {
                  const cardId = `${suit}_${rank}`;
                  const isSelected = selectedIds.includes(cardId);
                  const isInHand = myHandTypeIds.has(cardId);

                  return (
                    <motion.button
                      key={cardId}
                      onClick={() => !isInHand && toggle(cardId)}
                      disabled={isInHand}
                      title={isInHand ? 'In your hand — cannot select' : undefined}
                      whileHover={isInHand ? {} : { scale: 1.05 }}
                      whileTap={isInHand ? {} : { scale: 0.94 }}
                      className={clsx(
                        'relative w-10 h-14 rounded-lg border-2 flex flex-col justify-between p-1 text-[10px] font-bold transition-all',
                        isInHand
                          ? 'border-slate-700 bg-slate-900/60 opacity-50 cursor-not-allowed'
                          : isSelected
                            ? 'border-sky-400 bg-sky-950/50 shadow-[0_0_12px_rgba(56,189,248,0.4)] scale-105'
                            : isRed(suit)
                              ? 'border-slate-600 bg-slate-800 text-red-400 hover:border-slate-400 hover:scale-105'
                              : 'border-slate-600 bg-slate-800 text-slate-100 hover:border-slate-400 hover:scale-105'
                      )}
                    >
                      {/* Top rank + suit */}
                      <div className={clsx(
                        'leading-none',
                        isInHand ? 'text-slate-600' : isSelected ? 'text-sky-300' : isRed(suit) ? 'text-red-400' : 'text-slate-100'
                      )}>
                        <div>{rank}</div>
                        <div>{SUIT_SYMBOLS[suit]}</div>
                      </div>

                      {/* Center suit symbol */}
                      <div className={clsx(
                        'self-center text-base leading-none',
                        isInHand ? 'text-slate-600' : isSelected ? 'text-sky-300' : isRed(suit) ? 'text-red-400' : 'text-slate-100'
                      )}>
                        {SUIT_SYMBOLS[suit]}
                      </div>

                      {/* Amber dot for in-hand cards */}
                      {isInHand && (
                        <div className="absolute bottom-1 right-1 w-2 h-2 bg-amber-500 rounded-full" />
                      )}
                    </motion.button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-700 space-y-3 sticky bottom-0 bg-slate-900">
          {/* Selected cards summary pills */}
          {selectedIds.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selectedIds.map((id) => {
                const [suit, rank] = id.split('_') as [Suit, Rank];
                return (
                  <span
                    key={id}
                    className={clsx(
                      'inline-flex items-center gap-0.5 text-xs font-bold px-2 py-1 rounded-full border',
                      isRed(suit as Suit)
                        ? 'bg-red-950/60 border-red-700 text-red-300'
                        : 'bg-slate-800 border-slate-600 text-slate-200'
                    )}
                  >
                    {rank}{SUIT_SYMBOLS[suit as Suit]}
                  </span>
                );
              })}
            </div>
          )}

          {/* Confirm button */}
          <motion.button
            disabled={!isComplete}
            onClick={() => isComplete && onSelect(selectedIds)}
            whileHover={isComplete ? { scale: 1.02 } : {}}
            whileTap={isComplete ? { scale: 0.98 } : {}}
            className={clsx(
              'w-full rounded-xl py-3 text-sm font-black border transition-all duration-150 flex items-center justify-center gap-2',
              isComplete
                ? 'bg-gradient-to-r from-amber-600 to-yellow-600 text-black border-amber-500 shadow-lg shadow-amber-900/40 cursor-pointer'
                : 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed'
            )}
          >
            {isComplete
              ? `Confirm: ${selectedIds.map((id) => {
                  const [s, r] = id.split('_') as [Suit, Rank];
                  return `${r}${SUIT_SYMBOLS[s]}`;
                }).join(', ')}`
              : `Select ${partnerCount - selectedIds.length} more card${partnerCount - selectedIds.length !== 1 ? 's' : ''}`}
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}
