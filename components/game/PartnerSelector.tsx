'use client';
import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import type { Suit, Rank, Card as CardType } from '@/types';
import Button from '@/components/ui/Button';

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
  const allCards = useMemo(makeAllCards, []);
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" />

      <motion.div
        className="relative bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-2xl my-4"
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 28 }}
      >
        <div className="px-6 pt-6 pb-4 border-b border-slate-700">
          <h2 className="text-xl font-bold text-slate-100">Select 2 Partner Cards</h2>
          <p className="text-slate-400 text-sm mt-1">
            Players holding these cards will be your secret partners.
          </p>
          <p className="text-xs text-amber-400/70 mt-1">
            ⚠️ You cannot select cards from your own hand.
          </p>
          <div className="flex items-center gap-3 mt-3">
            <div
              className={clsx(
                'text-sm font-bold px-3 py-1 rounded-full border',
                selectedIds.length === partnerCount
                  ? 'border-green-500 bg-green-900/40 text-green-300'
                  : 'border-slate-600 bg-slate-800 text-slate-400'
              )}
            >
              {selectedIds.length}/{partnerCount} selected
            </div>
            <div className="text-xs text-slate-500">
              Trump: <span className={clsx('font-bold', isRed(trumpSuit) ? 'text-red-400' : 'text-slate-200')}>
                {SUIT_SYMBOLS[trumpSuit]} {SUIT_LABELS[trumpSuit]}
              </span>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
          {ALL_SUITS.map((suit) => (
            <div key={suit}>
              <div className={clsx(
                'flex items-center gap-2 mb-2 text-sm font-bold',
                isRed(suit) ? 'text-red-400' : 'text-slate-200'
              )}>
                <span className="text-lg">{SUIT_SYMBOLS[suit]}</span>
                {SUIT_LABELS[suit]}
                {suit === trumpSuit && (
                  <span className="text-[10px] bg-yellow-500 text-yellow-900 px-1.5 py-0.5 rounded font-bold">
                    TRUMP
                  </span>
                )}
              </div>
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
                      whileHover={isInHand ? {} : { scale: 1.08 }}
                      whileTap={isInHand ? {} : { scale: 0.94 }}
                      className={clsx(
                        'relative w-9 h-14 rounded-md border-2 text-xs font-bold flex flex-col items-center justify-center gap-0.5 transition-colors',
                        isInHand
                          ? 'border-slate-700 bg-slate-900/60 text-slate-600 opacity-40 cursor-not-allowed'
                          : isSelected
                            ? 'border-sky-400 bg-sky-900/50 text-sky-200 shadow-[0_0_8px_rgba(56,189,248,0.5)]'
                            : isRed(suit)
                              ? 'border-slate-600 bg-slate-800 text-red-400 hover:border-red-500 hover:bg-red-900/20'
                              : 'border-slate-600 bg-slate-800 text-slate-200 hover:border-slate-400 hover:bg-slate-700',
                      )}
                    >
                      <span className="text-[10px] leading-none">{rank}</span>
                      <span className="leading-none">{SUIT_SYMBOLS[suit]}</span>
                      {isInHand && (
                        <div className="absolute -top-1 -right-1 w-2 h-2 bg-amber-500 rounded-full" title="In your hand" />
                      )}
                    </motion.button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="px-6 py-4 border-t border-slate-700 space-y-3">
          <p className="text-xs text-amber-400/80">
            ⚠️ The players holding these cards will secretly be on your team. Keep your selection secret!
          </p>
          {selectedIds.length > 0 && (
            <div className="text-xs text-slate-400">
              Selected:{' '}
              {selectedIds.map((id) => {
                const [suit, rank] = id.split('_') as [Suit, Rank];
                return (
                  <span
                    key={id}
                    className={clsx(
                      'inline-flex items-center gap-0.5 font-bold mr-2',
                      isRed(suit) ? 'text-red-400' : 'text-slate-200'
                    )}
                  >
                    {rank}{SUIT_SYMBOLS[suit]}
                  </span>
                );
              })}
            </div>
          )}
          <Button
            size="lg"
            className="w-full"
            disabled={selectedIds.length !== partnerCount}
            onClick={() => selectedIds.length === partnerCount && onSelect(selectedIds)}
          >
            Confirm Partners ({selectedIds.length}/{partnerCount})
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
