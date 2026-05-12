'use client';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import type { Card as CardType, Suit } from '@/types';

const SUIT_SYMBOLS: Record<Suit, string> = {
  spades: '♠',
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
};

interface CardProps {
  card: CardType;
  faceDown?: boolean;
  selected?: boolean;
  playable?: boolean;
  onClick?: () => void;
  className?: string;
  small?: boolean;
  animate?: boolean;
  flat?: boolean;
}

export default function Card({
  card,
  faceDown = false,
  selected = false,
  playable = true,
  onClick,
  className,
  small = false,
  animate = false,
  flat = false,
}: CardProps) {
  const isThreeOfSpades = card.suit === 'spades' && card.rank === '3';
  const isRed = card.suit === 'hearts' || card.suit === 'diamonds';

  if (faceDown) {
    return (
      <motion.div
        layoutId={animate ? `card-${card.id}` : undefined}
        className={clsx(
          'relative rounded-lg border-2 border-blue-700/80 overflow-hidden',
          small ? 'w-10 h-16' : 'w-16 h-24',
          className
        )}
        style={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #1e40af 55%, #2563eb 100%)' }}
      >
        <div
          className="absolute rounded"
          style={{
            inset: 4,
            borderRadius: 4,
            border: '1px solid rgba(96,165,250,0.25)',
            backgroundImage:
              'repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(255,255,255,0.04) 3px, rgba(255,255,255,0.04) 6px)',
          }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={clsx('text-blue-400/40 font-bold', small ? 'text-lg' : 'text-2xl')}>
            ♠
          </span>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      layoutId={animate ? `card-${card.id}` : undefined}
      className={clsx(
        'relative rounded-lg border-2 flex flex-col justify-between cursor-pointer select-none',
        small ? 'w-10 h-16 p-0.5' : 'w-14 h-20 p-0.5 sm:w-16 sm:h-24 sm:p-1',
        isThreeOfSpades
          ? 'border-yellow-400 shadow-[0_0_18px_rgba(250,204,21,0.75)] bg-amber-50'
          : selected
            ? 'border-sky-400 shadow-[0_0_14px_rgba(56,189,248,0.65)] bg-white'
            : 'border-slate-200 bg-white',
        !playable && !selected && 'opacity-50 cursor-not-allowed',
        className
      )}
      onClick={playable || selected ? onClick : undefined}
      animate={flat ? {} : { y: selected ? -10 : 0 }}
      whileHover={(!flat && playable) ? { scale: 1.05, y: selected ? -14 : -4 } : {}}
      whileTap={(!flat && playable) ? { scale: 0.95 } : {}}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
    >
      {/* Top-left corner */}
      <div
        className={clsx(
          'flex flex-col leading-none font-bold',
          small ? 'text-[8px]' : 'text-xs',
          isRed ? 'text-red-500' : 'text-slate-800'
        )}
      >
        <span>{card.rank}</span>
        <span>{SUIT_SYMBOLS[card.suit]}</span>
      </div>

      {/* Center suit */}
      <div className="flex items-center justify-center">
        <span
          className={clsx(
            'font-bold leading-none',
            small ? 'text-lg' : 'text-3xl',
            isRed ? 'text-red-500' : 'text-slate-800'
          )}
        >
          {SUIT_SYMBOLS[card.suit]}
        </span>
      </div>

      {/* Bottom-right corner (rotated 180°) */}
      <div
        className={clsx(
          'flex flex-col leading-none font-bold rotate-180 self-end',
          small ? 'text-[8px]' : 'text-xs',
          isRed ? 'text-red-500' : 'text-slate-800'
        )}
      >
        <span>{card.rank}</span>
        <span>{SUIT_SYMBOLS[card.suit]}</span>
      </div>

      {/* 3 of Spades shimmer overlay */}
      {isThreeOfSpades && (
        <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-yellow-200/20 via-transparent to-yellow-400/20 pointer-events-none" />
      )}
    </motion.div>
  );
}
