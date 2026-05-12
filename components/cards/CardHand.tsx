'use client';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Card as CardType, Suit } from '@/types';
import Card from './Card';

const CARD_W = 64;
const CARD_H = 96;

const SUIT_ORDER: Record<Suit, number> = { spades: 0, clubs: 1, hearts: 2, diamonds: 3 };
const RANK_ORDER: Record<string, number> = {
  '3':1,'4':2,'5':3,'6':4,'7':5,'8':6,'9':7,'10':8,'J':9,'Q':10,'K':11,'A':12,
};

interface CardHandProps {
  cards: CardType[];
  playableCardIds?: Set<string>;
  selectedCardId?: string | null;
  onCardSelect?: (card: CardType) => void;
  onCardPlay?: (card: CardType) => void;
  isMyTurn?: boolean;
  leadSuit?: Suit | null;
  trumpSuit?: Suit | null;
  expandedView?: boolean;
}

function getHighlightSuit(cards: CardType[], leadSuit?: Suit | null, trumpSuit?: Suit | null): Suit | null {
  if (!leadSuit) return null;
  if (cards.some(c => c.suit === leadSuit)) return leadSuit;
  if (trumpSuit && cards.some(c => c.suit === trumpSuit)) return trumpSuit;
  return null;
}

export default function CardHand({
  cards,
  playableCardIds,
  selectedCardId,
  onCardSelect,
  onCardPlay,
  isMyTurn = false,
  leadSuit,
  trumpSuit,
  expandedView = false,
}: CardHandProps) {
  const [containerWidth, setContainerWidth] = useState(360);
  const containerRef = useRef<HTMLDivElement>(null);
  const [cardOrder, setCardOrder] = useState<string[]>([]);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  useEffect(() => {
    const check = () => {
      if (containerRef.current) setContainerWidth(containerRef.current.offsetWidth);
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Sync order: preserve user arrangement, append new, remove played
  useEffect(() => {
    const ids = cards.map(c => c.id);
    setCardOrder(prev => {
      const kept = prev.filter(id => ids.includes(id));
      const added = ids.filter(id => !kept.includes(id));
      return [...kept, ...added];
    });
  }, [cards]);

  if (cards.length === 0) return null;

  const count = cards.length;
  const highlightSuit = isMyTurn ? getHighlightSuit(cards, leadSuit, trumpSuit) : null;
  const isLeadHighlight = !!leadSuit && highlightSuit === leadSuit;

  // Scale: shrink cards when there are many
  const cardScale = count > 14 ? 0.68 : count > 11 ? 0.78 : count > 8 ? 0.90 : 1;
  const scaledW = CARD_W * cardScale;
  const scaledH = CARD_H * cardScale;

  // Step: spacing between card left-edges (with transformOrigin: top-left, step = scaledW means no overlap)
  const availW = Math.max(containerWidth - 120, 80);
  const step = expandedView
    ? Math.max(scaledW * 0.75, Math.min(scaledW * 0.90, (availW - scaledW) / (count - 1)))
    : count <= 1
    ? scaledW
    : Math.max(28, Math.min(scaledW * 0.85, (availW - scaledW) / (count - 1)));

  // Container dimensions
  const containerW = count <= 1 ? scaledW : Math.ceil(step * (count - 1) + scaledW);
  const containerH = scaledH + 40; // 40px headroom for lift animations
  // Cards sit near the bottom of the container (top = containerH - scaledH - 6)
  const baseTop = Math.round(containerH - scaledH - 6);

  // Ordered cards by user arrangement
  const orderedCards = cardOrder
    .map(id => cards.find(c => c.id === id))
    .filter(Boolean) as CardType[];

  const handleSort = () => {
    const sorted = [...cards].sort((a, b) => {
      const sd = SUIT_ORDER[a.suit] - SUIT_ORDER[b.suit];
      return sd !== 0 ? sd : RANK_ORDER[a.rank] - RANK_ORDER[b.rank];
    });
    setCardOrder(sorted.map(c => c.id));
  };

  const handleCardClick = (card: CardType) => {
    if (!isMyTurn) return;
    if (selectedCardId === card.id) onCardPlay?.(card);
    else onCardSelect?.(card);
  };

  const handleDragStart = (i: number) => setDragFrom(i);
  const handleDragEnter = (i: number) => { if (dragFrom !== null) setDragOver(i); };
  const handleDrop = () => {
    if (dragFrom !== null && dragOver !== null && dragFrom !== dragOver) {
      const next = [...cardOrder];
      const [item] = next.splice(dragFrom, 1);
      next.splice(dragOver, 0, item);
      setCardOrder(next);
    }
    setDragFrom(null);
    setDragOver(null);
  };

  return (
    <div className="flex flex-col items-center gap-1 select-none w-full" ref={containerRef}>
      {expandedView && (
        <div style={{
          textAlign: 'center',
          fontSize: '11px',
          color: 'rgba(212,160,23,0.8)',
          fontWeight: 600,
          letterSpacing: '0.05em',
          marginBottom: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%',
            background: '#d4a017', display: 'inline-block'
          }} />
          View your cards to bid wisely
        </div>
      )}
      {/* Header: hint + sort button */}
      <div className="flex items-center w-full px-3 min-h-5">
        <AnimatePresence>
          {isMyTurn && !selectedCardId && (
            <motion.p
              key="hint"
              initial={{ opacity: 0, y: 3 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 3 }}
              className="text-xs text-green-400/90 font-medium flex-1"
            >
              ✋ Tap to select · tap again to play
            </motion.p>
          )}
        </AnimatePresence>
        <button
          onClick={handleSort}
          className="ml-auto shrink-0 text-xs text-slate-400 hover:text-slate-200 bg-slate-800/90 border border-slate-600/60 rounded-full px-3 py-1 transition-colors font-medium"
          title="Sort cards by suit and rank"
        >
          ↕ Sort
        </button>
      </div>

      {/* Card area + Play button */}
      <div className="flex items-end justify-center w-full pb-2">
        {/* Absolute-positioned card container */}
        <div className="relative shrink-0" style={{ width: containerW, height: containerH }}>
          {orderedCards.map((card, i) => {
            const isSelected = selectedCardId === card.id;
            const isPlayable = !playableCardIds || playableCardIds.has(card.id);
            const isSuitMatch = !!highlightSuit && card.suit === highlightSuit;
            const isSuitHighlighted = isMyTurn && isSuitMatch && !isSelected;

            // Vertical lift: selected = big lift, suit match = small lift
            const yLift = isSelected ? -24 : (isSuitMatch && isMyTurn ? -10 : 0);

            // Z-index: selected on top (50), suit-match elevated (20+i), others by position (i+1)
            const zIndex = isSelected ? 50 : (isSuitMatch && isMyTurn ? 20 + i : i + 1);

            const isDraggingThis = dragFrom === i;
            const isDragTarget = dragOver === i && dragFrom !== null && dragFrom !== i;

            const glowColor = isLeadHighlight
              ? ['0 0 0px rgba(74,222,128,0)', '0 0 16px rgba(74,222,128,0.9)', '0 0 0px rgba(74,222,128,0)']
              : ['0 0 0px rgba(251,191,36,0)', '0 0 16px rgba(251,191,36,0.9)', '0 0 0px rgba(251,191,36,0)'];

            return (
              <motion.div
                key={card.id}
                className="absolute"
                style={{
                  left: Math.round(i * step),
                  top: baseTop,
                  zIndex,
                  transformOrigin: 'top left',
                  cursor: isMyTurn ? 'pointer' : 'default',
                }}
                initial={{ y: 60, opacity: 0 }}
                animate={{
                  scale: cardScale,
                  y: yLift,
                  opacity: isDraggingThis ? 0.45 : 1,
                }}
                transition={{ delay: i * 0.025, type: 'spring', stiffness: 340, damping: 26 }}
                draggable
                onDragStart={() => handleDragStart(i)}
                onDragEnter={e => { e.preventDefault(); handleDragEnter(i); }}
                onDragOver={e => e.preventDefault()}
                onDrop={handleDrop}
                onDragEnd={handleDrop}
              >
                {/* Suit highlight glow ring */}
                {isSuitHighlighted && (
                  <motion.div
                    className="absolute inset-0 rounded-xl pointer-events-none"
                    animate={{ boxShadow: glowColor }}
                    transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.06 }}
                  />
                )}
                {/* Generic playable glow (subtle, no suit match) */}
                {isMyTurn && isPlayable && !isSelected && !isSuitHighlighted && (
                  <motion.div
                    className="absolute inset-0 rounded-xl pointer-events-none"
                    animate={{ boxShadow: ['0 0 0px rgba(74,222,128,0)', '0 0 5px rgba(74,222,128,0.28)', '0 0 0px rgba(74,222,128,0)'] }}
                    transition={{ duration: 2.5, repeat: Infinity, delay: i * 0.1 }}
                  />
                )}
                {/* Drag-over indicator */}
                {isDragTarget && (
                  <div className="absolute inset-0 rounded-xl border-2 border-blue-400/70 pointer-events-none" />
                )}
                <Card
                  card={card}
                  selected={isSelected}
                  playable={isMyTurn && isPlayable}
                  onClick={() => handleCardClick(card)}
                  flat
                />
              </motion.div>
            );
          })}
        </div>

        {/* Play button */}
        <AnimatePresence>
          {selectedCardId && isMyTurn && (
            <motion.button
              key="play-btn"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="ml-3 mb-2 px-5 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white rounded-xl font-bold text-sm shadow-lg shadow-green-900/60 border border-green-500/60 shrink-0 min-h-[44px] transition-all"
              onClick={() => {
                const card = cards.find(c => c.id === selectedCardId);
                if (card) onCardPlay?.(card);
              }}
            >
              Play ▶
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
