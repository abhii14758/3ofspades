'use client';
import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Card as CardType, Suit } from '@/types';
import Card from '@/components/cards/Card';

const SUIT_ORDER: Record<Suit, number> = { spades: 0, clubs: 1, hearts: 2, diamonds: 3 };
const RANK_ORDER: Record<string, number> = {
  '3':1,'4':2,'5':3,'6':4,'7':5,'8':6,'9':7,'10':8,'J':9,'Q':10,'K':11,'A':12,
};

// Card dimensions for 'small flat'
const CARD_H = 60;

interface Props {
  cards: CardType[];
  selectedCardId: string | null;
  playableCardIds?: Set<string>;
  isMyTurn: boolean;
  phase: string;
  effectivelyHidden: boolean;
  handHidden: boolean;
  showDealAnim: boolean;
  onToggleHide: () => void;
  onCardSelect: (card: CardType) => void;
  onCardPlay: (card: CardType) => void;
  onDeselect: () => void;
}

export default function LandscapeCardColumn({
  cards,
  selectedCardId,
  playableCardIds,
  isMyTurn,
  phase,
  effectivelyHidden,
  handHidden,
  showDealAnim,
  onToggleHide,
  onCardSelect,
  onCardPlay,
  onDeselect,
}: Props) {
  const [sorted, setSorted] = useState(false);

  const sortedCards = useCallback(() => {
    if (!sorted) return cards;
    return [...cards].sort((a, b) => {
      const sd = SUIT_ORDER[a.suit] - SUIT_ORDER[b.suit];
      return sd !== 0 ? sd : RANK_ORDER[a.rank] - RANK_ORDER[b.rank];
    });
  }, [cards, sorted]);

  const displayCards = sortedCards();
  const count = displayCards.length;

  const handleCardTap = (card: CardType) => {
    if (effectivelyHidden || !isMyTurn) return;
    if (selectedCardId === card.id) {
      onCardPlay(card);
    } else {
      onCardSelect(card);
    }
  };

  return (
    <div className="flex flex-col w-full h-full">
      {/* ── Top control bar ── */}
      <div
        className="shrink-0 flex items-center justify-between gap-1 px-1.5 py-1"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        <button
          onClick={() => setSorted(v => !v)}
          className={`text-[9px] font-bold px-1.5 py-0.5 rounded border transition-colors ${
            sorted
              ? 'bg-amber-900/60 border-amber-600 text-amber-300'
              : 'bg-slate-800/70 border-slate-600 text-slate-400 hover:text-white'
          }`}
        >
          ↕ Sort
        </button>
        <button
          onClick={onToggleHide}
          className="text-[9px] font-bold px-1.5 py-0.5 rounded border bg-slate-800/70 border-slate-600 text-slate-400 hover:text-white transition-colors"
          title={handHidden ? 'Show cards' : 'Hide cards'}
        >
          {handHidden ? '👁️' : '🙈'}
        </button>
        <div className="text-[9px] text-slate-500 font-medium">{count}</div>
      </div>

      {/* ── Overlapping card fan ── */}
      <div className="relative flex-1 min-h-0 overflow-hidden">
        {!showDealAnim && count > 0 && (
          <>
            {displayCards.map((card, i) => {
              const isSelected = selectedCardId === card.id;
              const isPlayable = !playableCardIds || playableCardIds.has(card.id);
              // CSS calc for even spacing: top=0 for first, 100%-CARD_H for last
              const topCalc = count <= 1
                ? `calc(50% - ${CARD_H / 2}px)`
                : `calc(${i} * (100% - ${CARD_H}px) / ${count - 1})`;

              return (
                <motion.div
                  key={card.id}
                  className="absolute right-1"
                  style={{
                    top: topCalc,
                    zIndex: isSelected ? count + 10 : i + 1,
                  }}
                  animate={{ x: isSelected ? -8 : 0 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                >
                  {/* Selected glow ring */}
                  {isSelected && (
                    <div className="absolute inset-0 rounded-lg ring-2 ring-green-400/80 pointer-events-none z-10" />
                  )}
                  <Card
                    card={card}
                    faceDown={effectivelyHidden}
                    selected={!effectivelyHidden && isSelected}
                    playable={!effectivelyHidden && isMyTurn && isPlayable}
                    dimIfNotPlayable={phase !== 'bidding'}
                    onClick={() => handleCardTap(card)}
                    small
                    flat
                  />
                </motion.div>
              );
            })}
          </>
        )}

        {showDealAnim && (
          <div className="flex items-center justify-center h-full">
            <span className="text-[10px] text-slate-500 text-center px-2">Dealing…</span>
          </div>
        )}
      </div>

      {/* ── Play button (appears when card selected on your turn) ── */}
      <AnimatePresence>
        {selectedCardId && isMyTurn && phase === 'playing' && (
          <motion.div
            className="shrink-0 px-2 pb-2 pt-1"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
          >
            <button
              className="w-full py-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white rounded-lg font-black text-xs border border-green-500/60 shadow-lg shadow-green-900/40 transition-all"
              onClick={() => {
                const card = cards.find(c => c.id === selectedCardId);
                if (card) onCardPlay(card);
              }}
            >
              ▶ Play
            </button>
            <button
              className="w-full mt-1 py-1 text-[9px] text-slate-500 hover:text-slate-300 transition-colors"
              onClick={onDeselect}
            >
              cancel
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
