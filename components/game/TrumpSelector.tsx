'use client';
import { useState } from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import type { Suit, Card as CardType, Rank } from '@/types';

const SUIT_SYMBOLS: Record<Suit, string> = {
  spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣',
};
const SUIT_LABELS: Record<Suit, string> = {
  spades: 'Spades', hearts: 'Hearts', diamonds: 'Diamonds', clubs: 'Clubs',
};
const SUITS: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];

const RANK_VALS: Record<Rank, number> = {
  '3':1,'4':2,'5':3,'6':4,'7':5,'8':6,'9':7,'10':8,'J':9,'Q':10,'K':11,'A':12,
};

/** Count how many cards of each suit are in the hand */
function suitCounts(hand: CardType[]): Record<Suit, number> {
  const counts: Record<Suit, number> = { spades: 0, hearts: 0, diamonds: 0, clubs: 0 };
  for (const c of hand) counts[c.suit]++;
  return counts;
}

/** Max rank value in a suit */
function bestRank(hand: CardType[], suit: Suit): number {
  return hand.filter((c) => c.suit === suit).reduce((m, c) => Math.max(m, RANK_VALS[c.rank]), 0);
}

interface TrumpSelectorProps {
  onSelect: (suit: Suit) => void;
  bidAmount: number;
  myHand?: CardType[];
}

export default function TrumpSelector({ onSelect, bidAmount, myHand = [] }: TrumpSelectorProps) {
  const [selected, setSelected] = useState<Suit | null>(null);
  const isRed = (s: Suit) => s === 'hearts' || s === 'diamonds';
  const counts = suitCounts(myHand);

  // Sort hand: by suit then rank desc for compact display
  const sortedHand = [...myHand].sort((a, b) => {
    if (a.suit !== b.suit) return SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit);
    return RANK_VALS[b.rank] - RANK_VALS[a.rank];
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
      <motion.div
        className="relative bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-hidden flex flex-col"
        initial={{ opacity: 0, y: 60 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 340, damping: 28 }}
      >
        {/* Gold accent strip */}
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-amber-500 to-transparent" />

        {/* Header */}
        <div className="text-center pt-7 pb-4 px-6 shrink-0">
          <div className="inline-flex items-center gap-2 bg-amber-900/40 border border-amber-600/50 rounded-full px-4 py-1 mb-2">
            <span className="text-amber-300 text-sm font-bold">🏆 Bid Won: {bidAmount}</span>
          </div>
          <h2 className="text-xl font-black text-slate-100 mt-2">Select Trump Suit</h2>
          <p className="text-slate-400 text-sm mt-1">Choose the suit that will dominate this round</p>
        </div>

        {/* Your hand — scrollable horizontal strip */}
        {myHand.length > 0 && (
          <div className="px-4 pb-3 shrink-0">
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold mb-2 text-center">Your Hand</p>
            <div className="flex gap-1 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
              {sortedHand.map((card) => {
                const isCardRed = card.suit === 'hearts' || card.suit === 'diamonds';
                const is3Spades = card.rank === '3' && card.suit === 'spades';
                const highlighted = selected === card.suit;
                return (
                  <motion.div
                    key={card.id}
                    animate={{ y: highlighted ? -8 : 0, scale: highlighted ? 1.08 : 1 }}
                    transition={{ type: 'spring', stiffness: 380, damping: 22 }}
                    className={clsx(
                      'shrink-0 w-8 h-12 rounded-lg border-2 flex flex-col items-center justify-between p-0.5 bg-white select-none',
                      is3Spades
                        ? 'border-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.6)]'
                        : highlighted
                          ? (isCardRed ? 'border-red-400 shadow-[0_0_8px_rgba(248,113,113,0.5)]' : 'border-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.5)]')
                          : 'border-slate-200 shadow-sm opacity-70'
                    )}
                  >
                    <div className={clsx('self-start text-[8px] font-black leading-none', isCardRed ? 'text-red-500' : 'text-slate-800')}>
                      <div>{card.rank}</div>
                      <div>{SUIT_SYMBOLS[card.suit]}</div>
                    </div>
                    <div className={clsx('text-sm leading-none font-bold', isCardRed ? 'text-red-500' : 'text-slate-800')}>
                      {SUIT_SYMBOLS[card.suit]}
                    </div>
                    <div className={clsx('self-end text-[8px] font-black leading-none rotate-180', isCardRed ? 'text-red-500' : 'text-slate-800')}>
                      <div>{card.rank}</div>
                      <div>{SUIT_SYMBOLS[card.suit]}</div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}

        {/* Suit selection grid */}
        <div className="grid grid-cols-2 gap-3 px-4 pb-4 overflow-y-auto">
          {SUITS.map((suit) => {
            const isSelected = selected === suit;
            const count = counts[suit];
            const best = bestRank(myHand, suit);
            const bestRankName = Object.entries(RANK_VALS).find(([, v]) => v === best)?.[0] ?? '';

            return (
              <motion.button
                key={suit}
                onClick={() => setSelected(suit)}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className={clsx(
                  'relative flex flex-col items-center gap-2 p-4 rounded-2xl border-2 cursor-pointer transition-all duration-150 text-center',
                  isSelected
                    ? isRed(suit)
                      ? 'bg-red-950/60 border-red-500 shadow-[0_0_16px_rgba(239,68,68,0.3)]'
                      : 'bg-slate-800 border-slate-300 shadow-[0_0_16px_rgba(148,163,184,0.3)]'
                    : 'bg-slate-800/60 border-slate-700 hover:border-slate-500'
                )}
              >
                {/* Checkmark badge */}
                {isSelected && (
                  <motion.span
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="absolute top-2 right-2 text-[10px] bg-green-600 text-white w-4 h-4 rounded-full flex items-center justify-center font-bold"
                  >
                    ✓
                  </motion.span>
                )}

                {/* Large suit symbol */}
                <span className={clsx('text-4xl leading-none', isRed(suit) ? 'text-red-400' : 'text-slate-100')}>
                  {SUIT_SYMBOLS[suit]}
                </span>

                {/* Suit name */}
                <span className={clsx('font-bold text-base', isRed(suit) ? 'text-red-400' : 'text-slate-100')}>
                  {SUIT_LABELS[suit]}
                </span>

                {/* Card count */}
                <span className="text-xs text-slate-400">{count} card{count !== 1 ? 's' : ''}</span>

                {/* Best rank */}
                {count > 0 && bestRankName && (
                  <span className="text-xs text-slate-500">Best: {bestRankName}</span>
                )}
              </motion.button>
            );
          })}
        </div>

        {/* Confirm */}
        <div className="px-4 pb-6 pt-2 shrink-0">
          <motion.button
            disabled={!selected}
            onClick={() => selected && onSelect(selected)}
            whileHover={selected ? { scale: 1.02 } : {}}
            whileTap={selected ? { scale: 0.98 } : {}}
            className={clsx(
              'w-full rounded-xl py-3 text-sm font-black border transition-all duration-150 flex items-center justify-center gap-2',
              selected
                ? 'bg-gradient-to-r from-amber-600 to-yellow-600 text-black border-amber-500 shadow-lg shadow-amber-900/40 cursor-pointer'
                : 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed'
            )}
          >
            {selected
              ? `Confirm ${SUIT_SYMBOLS[selected]} ${SUIT_LABELS[selected]} as Trump`
              : 'Select a suit above'}
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}
