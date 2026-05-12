'use client';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
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
      <div className="flex flex-col items-center gap-2">
        <div className="w-20 h-20 rounded-full border-2 border-dashed border-green-700/30 flex items-center justify-center">
          <div className="text-center">
            {completedTricksCount > 0 ? (
              <>
                <div className="text-green-400 text-2xl font-bold">{completedTricksCount}</div>
                <div className="text-slate-500 text-xs">/{totalTricks}</div>
              </>
            ) : (
              <span className="text-amber-600/30 text-3xl">♠</span>
            )}
          </div>
        </div>
        {completedTricksCount > 0 && (
          <div className="flex items-center gap-1">
            {Array.from({ length: totalTricks }).map((_, i) => (
              <div key={i} className={clsx('w-2 h-2 rounded-full transition-colors',
                i < completedTricksCount
                  ? 'bg-green-500 shadow-[0_0_4px_rgba(34,197,94,0.6)]'
                  : 'bg-slate-700')} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-end gap-1.5 flex-wrap justify-center px-2">
        <AnimatePresence>
          {cards.map((tc, i) => {
            const isWinner = i === winnerIdx;
            const isRed = tc.card.suit === 'hearts' || tc.card.suit === 'diamonds';
            const isTrump = tc.card.suit === trumpSuit;
            const is3Spades = tc.card.rank === '3' && tc.card.suit === 'spades';

            return (
              <motion.div
                key={tc.playerId}
                initial={{ scale: 0.4, opacity: 0, y: -20 }}
                animate={{ scale: 1, opacity: 1, y: isWinner ? -8 : 0 }}
                exit={{ scale: 0.3, opacity: 0, transition: { duration: 0.15 } }}
                transition={{ delay: i * 0.07, type: 'spring', stiffness: 400, damping: 24 }}
                className="flex flex-col items-center gap-0.5"
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
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {completedTricksCount > 0 && (
        <div className="flex items-center gap-1">
          {Array.from({ length: totalTricks }).map((_, i) => (
            <div key={i} className={clsx('w-2 h-2 rounded-full transition-colors',
              i < completedTricksCount
                ? 'bg-green-500 shadow-[0_0_4px_rgba(34,197,94,0.6)]'
                : 'bg-slate-700')} />
          ))}
        </div>
      )}
    </div>
  );
}
