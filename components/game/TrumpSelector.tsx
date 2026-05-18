'use client';
import { useState, useEffect } from 'react';
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

function suitCounts(hand: CardType[]): Record<Suit, number> {
  const counts: Record<Suit, number> = { spades: 0, hearts: 0, diamonds: 0, clubs: 0 };
  for (const c of hand) counts[c.suit]++;
  return counts;
}

function bestRank(hand: CardType[], suit: Suit): number {
  return hand.filter((c) => c.suit === suit).reduce((m, c) => Math.max(m, RANK_VALS[c.rank]), 0);
}

function useViewport() {
  const [vp, setVp] = useState({ isMobilePortrait: false, isMobileLandscape: false });
  useEffect(() => {
    const check = () => {
      const w = window.innerWidth, h = window.innerHeight;
      const landscape = w > h && h < 520;
      const portrait = w < 640 && !landscape;
      setVp({ isMobilePortrait: portrait, isMobileLandscape: landscape });
    };
    check();
    window.addEventListener('resize', check);
    window.addEventListener('orientationchange', check);
    return () => {
      window.removeEventListener('resize', check);
      window.removeEventListener('orientationchange', check);
    };
  }, []);
  return vp;
}

interface TrumpSelectorProps {
  onSelect: (suit: Suit) => void;
  bidAmount: number;
  myHand?: CardType[];
}

export default function TrumpSelector({ onSelect, bidAmount, myHand = [] }: TrumpSelectorProps) {
  const [selected, setSelected] = useState<Suit | null>(null);
  const { isMobilePortrait, isMobileLandscape } = useViewport();

  const isRed = (s: Suit) => s === 'hearts' || s === 'diamonds';
  const counts = suitCounts(myHand);

  const sortedHand = [...myHand].sort((a, b) => {
    if (a.suit !== b.suit) return SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit);
    return RANK_VALS[b.rank] - RANK_VALS[a.rank];
  });

  // ─── Render helpers (plain functions, not components) ───────────────

  const renderCard = (card: CardType, compact: boolean) => {
    const isCardRed = card.suit === 'hearts' || card.suit === 'diamonds';
    const is3Spades = card.rank === '3' && card.suit === 'spades';
    const highlighted = selected === card.suit;
    const dimmed = selected !== null && selected !== card.suit && !is3Spades;
    return (
      <motion.div
        key={card.id}
        animate={{ opacity: dimmed ? 0.3 : 1, scale: highlighted ? 1.06 : 1 }}
        transition={{ type: 'spring', stiffness: 380, damping: 22 }}
        style={{ transformOrigin: 'bottom center' }}
        className={clsx(
          'shrink-0 rounded-lg border-2 flex flex-col items-center justify-between bg-white select-none',
          compact ? 'w-7 h-10 p-0.5' : 'w-8 h-12 p-0.5',
          is3Spades
            ? 'border-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.6)]'
            : highlighted
              ? (isCardRed ? 'border-red-400' : 'border-sky-400')
              : 'border-slate-200 shadow-sm'
        )}
      >
        <div className={clsx('self-start leading-none font-black', compact ? 'text-[7px]' : 'text-[8px]', isCardRed ? 'text-red-500' : 'text-slate-800')}>
          <div>{card.rank}</div><div>{SUIT_SYMBOLS[card.suit]}</div>
        </div>
        <div className={clsx('leading-none font-bold', compact ? 'text-xs' : 'text-sm', isCardRed ? 'text-red-500' : 'text-slate-800')}>
          {SUIT_SYMBOLS[card.suit]}
        </div>
        <div className={clsx('self-end leading-none font-black rotate-180', compact ? 'text-[7px]' : 'text-[8px]', isCardRed ? 'text-red-500' : 'text-slate-800')}>
          <div>{card.rank}</div><div>{SUIT_SYMBOLS[card.suit]}</div>
        </div>
      </motion.div>
    );
  };

  const renderHandStrip = (compact: boolean) => {
    if (!myHand.length) return null;
    return (
      <div className={clsx('shrink-0', compact ? 'px-3 pb-1' : 'px-4 pb-3')}>
        <p className="text-[9px] text-slate-500 uppercase tracking-widest font-semibold mb-1 text-center">Your Hand</p>
        <div className="flex gap-1" style={{ overflowX: 'auto', scrollbarWidth: 'none', paddingTop: 2, paddingBottom: 6 }}>
          {sortedHand.map(card => renderCard(card, compact))}
        </div>
      </div>
    );
  };

  const renderSuitButton = (suit: Suit, compact: boolean, horizontal: boolean) => {
    const isSelected = selected === suit;
    const count = counts[suit];
    const best = bestRank(myHand, suit);
    const bestRankName = Object.entries(RANK_VALS).find(([, v]) => v === best)?.[0] ?? '';
    return (
      <motion.button
        key={suit}
        onClick={() => setSelected(suit)}
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.96 }}
        className={clsx(
          'relative flex items-center gap-2 rounded-2xl border-2 cursor-pointer transition-all duration-150',
          horizontal
            ? 'flex-row px-3 py-2 justify-start'
            : 'flex-col text-center',
          compact ? (horizontal ? 'py-2' : 'p-2') : 'p-4',
          isSelected
            ? isRed(suit)
              ? 'bg-red-950/60 border-red-500 shadow-[0_0_16px_rgba(239,68,68,0.3)]'
              : 'bg-slate-800 border-slate-300 shadow-[0_0_16px_rgba(148,163,184,0.3)]'
            : 'bg-slate-800/60 border-slate-700 hover:border-slate-500'
        )}
      >
        {isSelected && (
          <motion.span
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="absolute top-1.5 right-1.5 text-[10px] bg-green-600 text-white w-4 h-4 rounded-full flex items-center justify-center font-bold shrink-0"
          >✓</motion.span>
        )}
        <span className={clsx('leading-none shrink-0', compact ? 'text-2xl' : 'text-4xl', isRed(suit) ? 'text-red-400' : 'text-slate-100')}>
          {SUIT_SYMBOLS[suit]}
        </span>
        <div className={clsx('flex gap-1', horizontal ? 'items-center flex-wrap' : 'flex-col items-center')}>
          <span className={clsx('font-bold', compact ? 'text-xs' : 'text-base', isRed(suit) ? 'text-red-400' : 'text-slate-100')}>
            {SUIT_LABELS[suit]}
          </span>
          <span className={clsx('text-slate-400', compact ? 'text-[10px]' : 'text-xs')}>
            {count} card{count !== 1 ? 's' : ''}
          </span>
          {bestRankName && count > 0 && (
            <span className={clsx('text-slate-500', compact ? 'text-[9px]' : 'text-xs')}>
              Best: {bestRankName}
            </span>
          )}
        </div>
      </motion.button>
    );
  };

  const renderConfirmButton = () => (
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
  );

  // ─── Portrait mobile: bottom sheet ──────────────────────────────────
  if (isMobilePortrait) {
    return (
      <div className="fixed inset-0 z-[500] bg-black/70 flex flex-col-reverse" style={{ touchAction: 'none' }}>
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', stiffness: 380, damping: 32 }}
          className="bg-slate-900 rounded-t-3xl flex flex-col overflow-hidden"
          style={{ maxHeight: '90dvh', boxShadow: '0 -8px 48px rgba(0,0,0,0.85)' }}
        >
          {/* Gold accent bar */}
          <div className="h-0.5 bg-gradient-to-r from-transparent via-amber-500 to-transparent shrink-0" />
          {/* Drag handle */}
          <div className="flex justify-center pt-2 pb-1 shrink-0">
            <div className="w-10 h-1 rounded-full bg-slate-600" />
          </div>
          {/* Header */}
          <div className="px-4 pb-2 text-center shrink-0">
            <div className="inline-flex items-center gap-1.5 bg-amber-900/40 border border-amber-600/50 rounded-full px-3 py-0.5 mb-1">
              <span className="text-amber-300 text-xs font-bold">🏆 Bid Won: {bidAmount}</span>
            </div>
            <h2 className="text-lg font-black text-slate-100">Select Trump Suit</h2>
          </div>
          {/* Hand strip */}
          {renderHandStrip(true)}
          {/* Suit grid — 2×2, scrollable if still too tall */}
          <div className="flex-1 overflow-y-auto px-4 pb-2 min-h-0">
            <div className="grid grid-cols-2 gap-2.5">
              {SUITS.map(suit => renderSuitButton(suit, true, false))}
            </div>
          </div>
          {/* Confirm button */}
          <div className="px-4 pt-2 pb-safe shrink-0" style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}>
            {renderConfirmButton()}
          </div>
        </motion.div>
      </div>
    );
  }

  // ─── Landscape mobile: full-screen horizontal split ─────────────────
  if (isMobileLandscape) {
    return (
      <div className="fixed inset-0 z-[500] bg-black/90 flex overflow-hidden">
        {/* Left panel: title + confirm */}
        <div className="w-[36%] flex flex-col justify-between p-3 border-r border-slate-700/60 bg-slate-900 shrink-0 overflow-y-auto">
          <div>
            <div className="inline-flex items-center gap-1 bg-amber-900/40 border border-amber-600/50 rounded-full px-2.5 py-0.5 mb-1.5">
              <span className="text-amber-300 text-[11px] font-bold">🏆 {bidAmount} pts</span>
            </div>
            <h2 className="text-sm font-black text-slate-100 leading-tight mb-1">Select Trump Suit</h2>
            {selected ? (
              <div className={clsx('text-lg font-black mt-1', isRed(selected) ? 'text-red-400' : 'text-slate-100')}>
                {SUIT_SYMBOLS[selected]} {SUIT_LABELS[selected]}
              </div>
            ) : (
              <p className="text-[11px] text-slate-500 mt-1">Tap a suit →</p>
            )}
          </div>
          {renderConfirmButton()}
        </div>
        {/* Right panel: hand + 4 suit buttons in a row */}
        <div className="flex-1 flex flex-col overflow-hidden bg-slate-900">
          {/* Hand strip */}
          {renderHandStrip(true)}
          {/* 4 suit buttons as vertical strips */}
          <div className="flex-1 grid grid-cols-4 gap-2 p-2 min-h-0">
            {SUITS.map((suit) => {
              const isSelected = selected === suit;
              const count = counts[suit];
              const best = bestRank(myHand, suit);
              const bestRankName = Object.entries(RANK_VALS).find(([, v]) => v === best)?.[0] ?? '';
              return (
                <motion.button
                  key={suit}
                  onClick={() => setSelected(suit)}
                  whileTap={{ scale: 0.95 }}
                  className={clsx(
                    'relative flex flex-col items-center justify-center gap-1 rounded-2xl border-2 cursor-pointer transition-all h-full',
                    isSelected
                      ? isRed(suit)
                        ? 'bg-red-950/60 border-red-500 shadow-[0_0_16px_rgba(239,68,68,0.3)]'
                        : 'bg-slate-800 border-slate-300 shadow-[0_0_12px_rgba(148,163,184,0.25)]'
                      : 'bg-slate-800/60 border-slate-700 active:border-slate-400'
                  )}
                >
                  {isSelected && (
                    <span className="absolute top-1 right-1 text-[9px] bg-green-600 text-white w-3.5 h-3.5 rounded-full flex items-center justify-center font-bold">✓</span>
                  )}
                  <span className={clsx('text-3xl leading-none', isRed(suit) ? 'text-red-400' : 'text-slate-100')}>
                    {SUIT_SYMBOLS[suit]}
                  </span>
                  <span className={clsx('font-bold text-xs', isRed(suit) ? 'text-red-400' : 'text-slate-100')}>
                    {SUIT_LABELS[suit]}
                  </span>
                  <span className="text-[10px] text-slate-400">{count} cards</span>
                  {bestRankName && <span className="text-[9px] text-slate-500">Best: {bestRankName}</span>}
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ─── Desktop: centered modal ─────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[500] bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
      <motion.div
        className="relative bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-hidden flex flex-col"
        initial={{ opacity: 0, y: 60 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 340, damping: 28 }}
      >
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-amber-500 to-transparent" />
        <div className="text-center pt-7 pb-4 px-6 shrink-0">
          <div className="inline-flex items-center gap-2 bg-amber-900/40 border border-amber-600/50 rounded-full px-4 py-1 mb-2">
            <span className="text-amber-300 text-sm font-bold">🏆 Bid Won: {bidAmount}</span>
          </div>
          <h2 className="text-xl font-black text-slate-100 mt-2">Select Trump Suit</h2>
          <p className="text-slate-400 text-sm mt-1">Choose the suit that will dominate this round</p>
        </div>
        {renderHandStrip(false)}
        <div className="grid grid-cols-2 gap-3 px-4 pb-4 flex-1 overflow-y-auto min-h-0">
          {SUITS.map(suit => renderSuitButton(suit, false, false))}
        </div>
        <div className="px-4 pb-6 pt-2 shrink-0">
          {renderConfirmButton()}
        </div>
      </motion.div>
    </div>
  );
}
