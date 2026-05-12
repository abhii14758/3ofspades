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
        <div className="w-24 h-24 md:w-32 md:h-32 rounded-full border-2 border-dashed border-green-700/30 flex items-center justify-center">
          <div className="text-center">
            {completedTricksCount > 0 ? (
              <>
                <div className="text-green-500 text-2xl font-bold">{completedTricksCount}</div>
                <div className="text-green-700/60 text-xs">/{totalTricks}</div>
              </>
            ) : (
              <span className="text-green-800/40 text-3xl font-bold">♠</span>
            )}
          </div>
        </div>
        {completedTricksCount > 0 && (
          <div className="flex items-center gap-1">
            {Array.from({ length: totalTricks }).map((_, i) => (
              <div key={i} className={clsx('w-1.5 h-1.5 rounded-full transition-colors',
                i < completedTricksCount ? 'bg-green-500' : 'bg-slate-700')} />
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
                animate={{ scale: 1, opacity: 1, y: isWinner ? -6 : 0 }}
                exit={{ scale: 0.3, opacity: 0, transition: { duration: 0.15 } }}
                transition={{ delay: i * 0.07, type: 'spring', stiffness: 400, damping: 24 }}
                className="flex flex-col items-center gap-0.5"
              >
                {isWinner && cards.length > 1 && (
                  <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-xs leading-none">
                    👑
                  </motion.span>
                )}
                <div
                  className={clsx(
                    'flex flex-col items-center justify-between p-0.5 bg-white rounded-lg border-2 select-none',
                    'w-10 h-14 md:w-11 md:h-16',
                    is3Spades
                      ? 'border-yellow-400 shadow-[0_0_12px_rgba(250,204,21,0.8)]'
                      : isWinner
                        ? 'border-yellow-300 shadow-[0_0_12px_rgba(253,224,71,0.7)] ring-1 ring-yellow-200'
                        : isTrump
                          ? 'border-orange-300 shadow-[0_0_6px_rgba(253,186,116,0.4)]'
                          : 'border-slate-200 shadow-md'
                  )}
                >
                  <div className={clsx('self-start leading-none font-black text-[9px]', isRed ? 'text-red-500' : 'text-slate-800')}>
                    <div>{tc.card.rank}</div>
                    <div>{SUIT_SYMBOLS[tc.card.suit]}</div>
                  </div>
                  <div className={clsx('text-lg leading-none font-bold', isRed ? 'text-red-500' : 'text-slate-800')}>
                    {SUIT_SYMBOLS[tc.card.suit]}
                  </div>
                  <div className={clsx('self-end leading-none font-black text-[9px] rotate-180', isRed ? 'text-red-500' : 'text-slate-800')}>
                    <div>{tc.card.rank}</div>
                    <div>{SUIT_SYMBOLS[tc.card.suit]}</div>
                  </div>
                </div>
                <span className={clsx('text-[9px] font-medium truncate max-w-[44px] text-center',
                  isWinner ? 'text-yellow-400' : 'text-slate-400')}>
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
            <div key={i} className={clsx('w-1.5 h-1.5 rounded-full transition-colors',
              i < completedTricksCount ? 'bg-green-500' : 'bg-slate-700')} />
          ))}
        </div>
      )}
    </div>
  );
}
