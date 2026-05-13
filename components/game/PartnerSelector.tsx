'use client';
import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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

interface SlotEntry {
  typeId: string;
  ordinal: 1 | 2;
}

interface PartnerSelectorProps {
  onSelect: (slots: SlotEntry[]) => void;
  trumpSuit: Suit;
  myHand: CardType[];
  partnerCount?: number;
  deckCount?: number;
}

export default function PartnerSelector({
  onSelect,
  trumpSuit,
  myHand,
  partnerCount = 2,
  deckCount = 1,
}: PartnerSelectorProps) {
  const [selectedSlots, setSelectedSlots] = useState<SlotEntry[]>([]);
  const [pendingCard, setPendingCard] = useState<string | null>(null); // typeId awaiting ordinal

  const myHandTypeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of myHand) {
      const t = `${c.suit}_${c.rank}`;
      counts[t] = (counts[t] ?? 0) + 1;
    }
    return counts;
  }, [myHand]);

  const isRed = (suit: Suit) => suit === 'hearts' || suit === 'diamonds';

  const handleCardClick = (typeId: string) => {
    const heldCount = myHandTypeCounts[typeId] ?? 0;
    const maxSelectable = deckCount - heldCount;
    if (maxSelectable <= 0) return; // fully in hand

    const currentSlots = selectedSlots.filter(s => s.typeId === typeId);

    if (currentSlots.length > 0) {
      // Clicking again deselects all slots for this card
      setSelectedSlots(prev => prev.filter(s => s.typeId !== typeId));
      return;
    }

    if (selectedSlots.length >= partnerCount) return; // already at max

    if (deckCount === 1) {
      // Single deck: always ordinal 1, no popup
      setSelectedSlots(prev => [...prev, { typeId, ordinal: 1 }]);
    } else {
      // Double deck: show ordinal popup
      setPendingCard(typeId);
    }
  };

  const handleOrdinalSelect = (ordinal: 1 | 2) => {
    if (!pendingCard) return;
    setSelectedSlots(prev => [...prev, { typeId: pendingCard, ordinal }]);
    setPendingCard(null);
  };

  const isComplete = selectedSlots.length === partnerCount;

  const getSlotsForTypeId = (typeId: string) => selectedSlots.filter(s => s.typeId === typeId);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <motion.div
        className="relative bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 28 }}
      >
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-amber-500 to-transparent" />

        <div className="px-6 pt-7 pb-4 border-b border-slate-700 sticky top-0 bg-slate-900 z-10">
          <h2 className="text-xl font-black text-slate-100">
            Select Partner Card{partnerCount !== 1 ? 's' : ''}
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Choose {partnerCount} secret partner card{partnerCount !== 1 ? 's' : ''}
            {deckCount === 2 && ' — specify which occurrence (1st or 2nd played)'}
          </p>
          <div className="flex items-center gap-3 mt-3">
            <div className={clsx(
              'text-sm font-bold px-3 py-1 rounded-full border',
              isComplete
                ? 'bg-emerald-900/60 border-emerald-600 text-emerald-300'
                : 'bg-slate-800 border-slate-600 text-slate-400'
            )}>
              {selectedSlots.length}/{partnerCount} selected
            </div>
            <div className="text-xs text-slate-500">
              Trump:{' '}
              <span className={clsx('font-bold', isRed(trumpSuit) ? 'text-red-400' : 'text-slate-200')}>
                {SUIT_SYMBOLS[trumpSuit]} {SUIT_LABELS[trumpSuit]}
              </span>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-5">
          {ALL_SUITS.map((suit) => (
            <div key={suit}>
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

              <div className="flex flex-wrap gap-1.5">
                {ALL_RANKS.map((rank) => {
                  const cardTypeId = `${suit}_${rank}`;
                  const slots = getSlotsForTypeId(cardTypeId);
                  const selectedCount = slots.length;
                  const heldCount = myHandTypeCounts[cardTypeId] ?? 0;
                  const maxSelectable = deckCount - heldCount;
                  const isFullyInHand = maxSelectable <= 0;

                  return (
                    <motion.button
                      key={cardTypeId}
                      onClick={() => !isFullyInHand && handleCardClick(cardTypeId)}
                      disabled={isFullyInHand}
                      whileHover={isFullyInHand ? {} : { scale: 1.05 }}
                      whileTap={isFullyInHand ? {} : { scale: 0.94 }}
                      className={clsx(
                        'relative w-10 h-14 rounded-lg border-2 flex flex-col justify-between p-1 text-[10px] font-bold transition-all',
                        isFullyInHand
                          ? 'border-slate-700 bg-slate-900/60 opacity-50 cursor-not-allowed'
                          : selectedCount > 0
                            ? 'border-sky-400 bg-sky-950/50 shadow-[0_0_12px_rgba(56,189,248,0.4)] scale-105'
                            : isRed(suit)
                              ? 'border-slate-600 bg-slate-800 text-red-400 hover:border-slate-400 hover:scale-105'
                              : 'border-slate-600 bg-slate-800 text-slate-100 hover:border-slate-400 hover:scale-105'
                      )}
                    >
                      <div className={clsx(
                        'leading-none',
                        isFullyInHand ? 'text-slate-600' : selectedCount > 0 ? 'text-sky-300' : isRed(suit) ? 'text-red-400' : 'text-slate-100'
                      )}>
                        <div>{rank}</div>
                        <div>{SUIT_SYMBOLS[suit]}</div>
                      </div>
                      <div className={clsx(
                        'self-center text-base leading-none',
                        isFullyInHand ? 'text-slate-600' : selectedCount > 0 ? 'text-sky-300' : isRed(suit) ? 'text-red-400' : 'text-slate-100'
                      )}>
                        {SUIT_SYMBOLS[suit]}
                      </div>
                      {heldCount > 0 && (
                        <div className="absolute bottom-1 right-1 w-2 h-2 bg-amber-500 rounded-full"
                             title={`${heldCount}/${deckCount} in your hand`} />
                      )}
                      {selectedCount > 0 && (
                        <div className="absolute top-0.5 left-0.5 text-[8px] font-black text-sky-200 leading-none">
                          {slots.map(s => s.ordinal === 1 ? '1st' : '2nd').join('+')}
                        </div>
                      )}
                    </motion.button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="px-6 py-4 border-t border-slate-700 space-y-3 sticky bottom-0 bg-slate-900">
          {selectedSlots.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selectedSlots.map((slot, i) => {
                const [suit, rank] = slot.typeId.split('_') as [Suit, Rank];
                return (
                  <span
                    key={i}
                    className={clsx(
                      'inline-flex items-center gap-0.5 text-xs font-bold px-2 py-1 rounded-full border',
                      isRed(suit)
                        ? 'bg-red-950/60 border-red-700 text-red-300'
                        : 'bg-slate-800 border-slate-600 text-slate-200'
                    )}
                  >
                    {rank}{SUIT_SYMBOLS[suit]}
                    {deckCount === 2 && (
                      <span className="ml-1 text-[9px] text-slate-400">({slot.ordinal === 1 ? '1st' : '2nd'})</span>
                    )}
                  </span>
                );
              })}
            </div>
          )}

          <motion.button
            disabled={!isComplete}
            onClick={() => isComplete && onSelect(selectedSlots)}
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
              ? `Confirm: ${selectedSlots.map(s => {
                  const [suit, rank] = s.typeId.split('_') as [Suit, Rank];
                  return `${rank}${SUIT_SYMBOLS[suit]}${deckCount === 2 ? `(${s.ordinal === 1 ? '1st' : '2nd'})` : ''}`;
                }).join(', ')}`
              : `Select ${partnerCount - selectedSlots.length} more card${partnerCount - selectedSlots.length !== 1 ? 's' : ''}`}
          </motion.button>
        </div>
      </motion.div>

      {/* Ordinal selection popup (double-deck only) */}
      <AnimatePresence>
        {pendingCard && (
          <motion.div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-slate-800 border border-slate-600 rounded-2xl p-6 shadow-2xl max-w-xs w-full mx-4"
              initial={{ scale: 0.85, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.85, y: 20 }}
            >
              {(() => {
                const [suit, rank] = pendingCard.split('_') as [Suit, Rank];
                const isRedCard = suit === 'hearts' || suit === 'diamonds';
                return (
                  <>
                    <p className="text-center text-sm text-slate-300 mb-4 font-semibold">
                      Which occurrence of{' '}
                      <span className={clsx('font-black', isRedCard ? 'text-red-400' : 'text-white')}>
                        {rank}{SUIT_SYMBOLS[suit]}
                      </span>
                      {' '}calls your partner?
                    </p>
                    <div className="flex gap-3 mb-4">
                      <button
                        onClick={() => handleOrdinalSelect(1)}
                        className="flex-1 py-3 rounded-xl bg-sky-700 hover:bg-sky-600 border border-sky-500 text-white font-black text-sm transition-colors"
                      >
                        🥇 1st played
                      </button>
                      <button
                        onClick={() => handleOrdinalSelect(2)}
                        className="flex-1 py-3 rounded-xl bg-indigo-700 hover:bg-indigo-600 border border-indigo-500 text-white font-black text-sm transition-colors"
                      >
                        🥈 2nd played
                      </button>
                    </div>
                    <button
                      onClick={() => setPendingCard(null)}
                      className="w-full py-2 text-xs text-slate-400 hover:text-slate-200 transition-colors"
                    >
                      Cancel
                    </button>
                  </>
                );
              })()}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
