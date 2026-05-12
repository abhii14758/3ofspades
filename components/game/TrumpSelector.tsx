'use client';
import { useState } from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import type { Suit, Card as CardType, Rank } from '@/types';
import Button from '@/components/ui/Button';

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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" />

      <motion.div
        className="relative bg-slate-900 border border-slate-700 rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg flex flex-col max-h-[92vh]"
        initial={{ opacity: 0, y: 60 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 340, damping: 28 }}
      >
        {/* Header */}
        <div className="text-center pt-6 pb-4 px-6 shrink-0">
          <div className="inline-flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/30 rounded-full px-4 py-1 mb-3">
            <span className="text-yellow-400 text-sm font-bold">🏆 Bid Won: {bidAmount}</span>
          </div>
          <h2 className="text-xl font-bold text-slate-100">Choose Trump Suit</h2>
          <p className="text-slate-400 text-sm mt-1">Review your cards, then pick the strongest suit</p>
        </div>

        {/* Your hand — scrollable horizontal strip */}
        {myHand.length > 0 && (
          <div className="px-4 pb-3 shrink-0">
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold mb-2 text-center">Your Hand</p>
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin" style={{ scrollbarWidth: 'none' }}>
              {sortedHand.map((card) => {
                const isCardRed = card.suit === 'hearts' || card.suit === 'diamonds';
                const is3Spades = card.rank === '3' && card.suit === 'spades';
                const highlighted = selected === card.suit;
                return (
                  <motion.div
                    key={card.id}
                    animate={{ y: highlighted ? -6 : 0, scale: highlighted ? 1.08 : 1 }}
                    transition={{ type: 'spring', stiffness: 380, damping: 22 }}
                    className={clsx(
                      'shrink-0 w-9 h-14 rounded-lg border-2 flex flex-col items-center justify-between p-0.5 bg-white select-none',
                      is3Spades
                        ? 'border-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.6)]'
                        : highlighted
                          ? (isCardRed ? 'border-red-400 shadow-[0_0_8px_rgba(248,113,113,0.5)]' : 'border-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.5)]')
                          : 'border-slate-200 shadow-sm'
                    )}
                  >
                    <div className={clsx('self-start text-[9px] font-black leading-none', isCardRed ? 'text-red-500' : 'text-slate-800')}>
                      <div>{card.rank}</div>
                      <div>{SUIT_SYMBOLS[card.suit]}</div>
                    </div>
                    <div className={clsx('text-base leading-none font-bold', isCardRed ? 'text-red-500' : 'text-slate-800')}>
                      {SUIT_SYMBOLS[card.suit]}
                    </div>
                    <div className={clsx('self-end text-[9px] font-black leading-none rotate-180', isCardRed ? 'text-red-500' : 'text-slate-800')}>
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
        <div className="grid grid-cols-2 gap-3 px-4 pb-4">
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
                  'flex items-center gap-3 p-4 rounded-xl border-2 font-bold transition-colors duration-150 text-left',
                  isSelected
                    ? isRed(suit)
                      ? 'border-red-400 bg-red-900/40 text-red-300'
                      : 'border-slate-300 bg-slate-700/60 text-slate-100'
                    : isRed(suit)
                      ? 'border-slate-700 bg-slate-800 text-red-400 hover:border-red-600 hover:bg-red-900/20'
                      : 'border-slate-700 bg-slate-800 text-slate-200 hover:border-slate-500 hover:bg-slate-700/60'
                )}
              >
                <span className="text-3xl leading-none">{SUIT_SYMBOLS[suit]}</span>
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm leading-none">{SUIT_LABELS[suit]}</span>
                  <span className="text-[10px] font-normal opacity-70">
                    {count} card{count !== 1 ? 's' : ''}{count > 0 ? ` · best ${bestRankName}` : ''}
                  </span>
                </div>
                {isSelected && (
                  <motion.span
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="ml-auto text-xs bg-green-600 text-white px-2 py-0.5 rounded-full shrink-0"
                  >
                    ✓
                  </motion.span>
                )}
              </motion.button>
            );
          })}
        </div>

        {/* Confirm */}
        <div className="px-4 pb-6 shrink-0">
          <Button
            size="lg"
            className="w-full"
            disabled={!selected}
            onClick={() => selected && onSelect(selected)}
          >
            {selected
              ? `Confirm ${SUIT_SYMBOLS[selected]} ${SUIT_LABELS[selected]} as Trump`
              : 'Select a suit above'}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
