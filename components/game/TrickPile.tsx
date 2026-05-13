'use client';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { gsap } from 'gsap';
import type { Trick, Player, Suit, Rank } from '@/types';

const SUIT_SYMBOLS: Record<string, string> = {
  spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣',
};
const RANK_VALS: Record<Rank, number> = {
  '3':1,'4':2,'5':3,'6':4,'7':5,'8':6,'9':7,'10':8,'J':9,'Q':10,'K':11,'A':12,
};

function getCardPower(
  rank: Rank, suit: Suit,
  leadSuit: Suit | null, trumpSuit: Suit | null
): number {
  if (rank === '3' && suit === 'spades' && trumpSuit === 'spades') return 2000;
  if (trumpSuit && suit === trumpSuit) return 100 + RANK_VALS[rank];
  if (leadSuit && suit === leadSuit) return RANK_VALS[rank];
  return 0;
}

function getCurrentWinnerIdx(trick: Trick, trumpSuit: Suit | null): number {
  if (!trick.cards.length) return -1;
  const lead = trick.leadSuit;
  let bestIdx = 0;
  let bestPow = getCardPower(trick.cards[0].card.rank, trick.cards[0].card.suit, lead, trumpSuit);
  for (let i = 1; i < trick.cards.length; i++) {
    const p = getCardPower(trick.cards[i].card.rank, trick.cards[i].card.suit, lead, trumpSuit);
    if (p > bestPow) { bestPow = p; bestIdx = i; }
  }
  return bestIdx;
}

interface TrickPileProps {
  trick: Trick | null;
  players: Player[];
  trumpSuit: Suit | null;
  completedTricksCount?: number;
  totalTricks?: number;
}

export default function TrickPile({
  trick,
  players,
  trumpSuit,
  completedTricksCount = 0,
  totalTricks = 8,
}: TrickPileProps) {
  const cards = trick?.cards ?? [];
  const winnerIdx = trick ? getCurrentWinnerIdx(trick, trumpSuit) : -1;
  const getPlayerName = (id: string) => players.find((p) => p.id === id)?.name ?? '';

  if (cards.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 pointer-events-none">
        {completedTricksCount > 0 && (
          <div
            className="flex items-center gap-1 px-2.5 py-1 rounded-full font-bold"
            style={{
              background: 'rgba(0,0,0,0.5)',
              border: '1px solid rgba(212,160,23,0.3)',
              color: 'rgba(212,160,23,0.9)',
              backdropFilter: 'blur(4px)',
            }}
          >
            <span style={{ fontSize: 10 }}>Trick</span>
            <span style={{ fontSize: 14, fontWeight: 900 }}>{completedTricksCount}</span>
            <span style={{ fontSize: 10, opacity: 0.6 }}>/ {totalTricks}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-end gap-2 flex-wrap justify-center px-2">
        {cards.map((tc, i) => {
          const isWinner = i === winnerIdx;
          const isRed = tc.card.suit === 'hearts' || tc.card.suit === 'diamonds';
          const isTrump = tc.card.suit === trumpSuit;
          const is3Spades = tc.card.rank === '3' && tc.card.suit === 'spades';

          return (
            <div
              className="flex flex-col items-center gap-0.5"
              key={tc.playerId}
              ref={(el) => {
                if (el) {
                  gsap.fromTo(el,
                    { scale: 0.5, opacity: 0, y: -16 },
                    { scale: 1, opacity: 1, y: isWinner ? -8 : 0, duration: 0.28, delay: i * 0.07, ease: 'back.out(1.4)' }
                  );
                }
              }}
            >
                {isWinner && cards.length > 1 && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                    className="text-sm leading-none"
                  >
                    👑
                  </motion.span>
                )}
                <div
                  style={{
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'space-between',
                    borderRadius: 8,
                    width: 48, height: 68,
                    background: '#ffffff',
                    border: isWinner
                      ? '2px solid #fde68a'
                      : is3Spades
                      ? '2px solid #d4a017'
                      : isTrump
                      ? '1.5px solid rgba(253,186,116,0.7)'
                      : '1.5px solid #d0d0d0',
                    boxShadow: isWinner
                      ? '0 0 0 2px rgba(253,224,71,0.6), 0 0 24px rgba(253,224,71,0.8), 0 8px 20px rgba(0,0,0,0.7)'
                      : is3Spades
                      ? '0 0 18px rgba(212,160,23,0.7), 0 4px 14px rgba(0,0,0,0.6)'
                      : isTrump
                      ? '0 0 10px rgba(253,186,116,0.5), 0 4px 12px rgba(0,0,0,0.5)'
                      : '0 4px 12px rgba(0,0,0,0.5)',
                    padding: '3px 4px',
                    overflow: 'hidden',
                    position: 'relative',
                    transform: isWinner ? 'translateY(-6px) scale(1.05)' : 'none',
                    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                  }}
                >
                  {is3Spades && (
                    <div className="absolute inset-0 rounded-lg overflow-hidden pointer-events-none">
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />
                    </div>
                  )}
                  {/* Top-left rank+suit */}
                  <div style={{ alignSelf: 'flex-start', lineHeight: 1 }}>
                    <div style={{
                      fontSize: 10, fontWeight: 800, lineHeight: 1,
                      color: isRed ? '#c0152a' : '#1a1a2e',
                    }}>{tc.card.rank}</div>
                    <div style={{
                      fontSize: 9, lineHeight: 1,
                      color: isRed ? '#c0152a' : '#1a1a2e',
                    }}>{SUIT_SYMBOLS[tc.card.suit]}</div>
                  </div>
                  {/* Center suit */}
                  <div style={{
                    fontSize: 18, lineHeight: 1, fontWeight: 700,
                    color: isRed ? '#c0152a' : '#1a1a2e',
                  }}>
                    {SUIT_SYMBOLS[tc.card.suit]}
                  </div>
                  {/* Bottom-right rotated */}
                  <div style={{
                    alignSelf: 'flex-end', lineHeight: 1,
                    transform: 'rotate(180deg)',
                  }}>
                    <div style={{
                      fontSize: 10, fontWeight: 800, lineHeight: 1,
                      color: isRed ? '#c0152a' : '#1a1a2e',
                    }}>{tc.card.rank}</div>
                    <div style={{
                      fontSize: 9, lineHeight: 1,
                      color: isRed ? '#c0152a' : '#1a1a2e',
                    }}>{SUIT_SYMBOLS[tc.card.suit]}</div>
                  </div>
                </div>
              <span className={clsx('text-xs font-medium truncate max-w-[44px] text-center',
                isWinner ? 'text-yellow-400 font-bold' : 'text-slate-400')}>
                {getPlayerName(tc.playerId)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
