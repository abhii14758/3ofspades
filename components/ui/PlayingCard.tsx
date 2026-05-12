'use client';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import type { Card, Suit } from '@/types';

export const SUIT_SYMBOLS: Record<Suit, string> = {
  spades: '♠',
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
};

const SUIT_TEXT_COLORS: Record<Suit, string> = {
  spades: 'text-slate-900',
  clubs: 'text-slate-900',
  hearts: 'text-red-600',
  diamonds: 'text-red-600',
};

interface PlayingCardProps {
  card: Card;
  playable?: boolean;
  selected?: boolean;
  small?: boolean;
  faceDown?: boolean;
  onClick?: (card: Card) => void;
  className?: string;
}

export function PlayingCard({
  card,
  playable,
  selected,
  small,
  onClick,
  className,
}: PlayingCardProps) {
  const symbol = SUIT_SYMBOLS[card.suit];
  const colorClass = SUIT_TEXT_COLORS[card.suit];

  return (
    <motion.div
      layout
      whileHover={playable ? { y: -10, scale: 1.06 } : {}}
      whileTap={playable ? { scale: 0.96 } : {}}
      onClick={() => playable && onClick?.(card)}
      className={clsx(
        'relative bg-white rounded-lg border-2 select-none transition-colors duration-150',
        small ? 'w-10 h-14 text-[10px]' : 'w-16 h-24 text-sm',
        playable
          ? 'cursor-pointer border-green-400 card-shadow animate-pulse-glow'
          : 'border-slate-300 card-shadow opacity-90',
        selected && 'border-yellow-400 glow-gold',
        className,
      )}
    >
      {/* Top-left rank + suit */}
      <div className={clsx('absolute top-1 left-1.5 font-bold leading-none', colorClass)}>
        <div>{card.rank}</div>
        <div>{symbol}</div>
      </div>

      {/* Centre suit symbol */}
      <div
        className={clsx(
          'absolute inset-0 flex items-center justify-center font-bold',
          small ? 'text-xl' : 'text-3xl',
          colorClass,
        )}
      >
        {symbol}
      </div>

      {/* Bottom-right (rotated) */}
      <div
        className={clsx(
          'absolute bottom-1 right-1.5 font-bold leading-none rotate-180',
          colorClass,
        )}
      >
        <div>{card.rank}</div>
        <div>{symbol}</div>
      </div>

      {/* Point badge */}
      {card.points > 0 && (
        <div className="absolute top-0 right-0 bg-yellow-400 text-slate-900 text-[7px] font-black rounded-bl-md rounded-tr-md px-1 leading-4">
          {card.points}
        </div>
      )}
    </motion.div>
  );
}

export function CardBack({
  small,
  className,
}: {
  small?: boolean;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        'relative rounded-lg border-2 border-blue-700 bg-blue-800 card-shadow overflow-hidden',
        small ? 'w-10 h-14' : 'w-16 h-24',
        className,
      )}
    >
      <div className="absolute inset-1 rounded border border-blue-600 bg-[repeating-linear-gradient(45deg,#1e3a8a,#1e3a8a_2px,#1d4ed8_2px,#1d4ed8_8px)]" />
    </div>
  );
}
