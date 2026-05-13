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

const SUIT_COLORS: Record<Suit, string> = {
  spades: '#1a1a2e',
  hearts: '#c0152a',
  diamonds: '#c0152a',
  clubs: '#1a1a2e',
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
  dimIfNotPlayable?: boolean;
}

function PipGrid({ rank, suit, color }: { rank: string; suit: string; color: string }) {
  const sym = SUIT_SYMBOLS[suit as Suit];

  if (rank === 'A') {
    return (
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ fontSize: '1.8rem', color, lineHeight: 1, fontWeight: 700 }}>{sym}</span>
      </div>
    );
  }

  if (['J', 'Q', 'K'].includes(rank)) {
    return (
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 2,
      }}>
        <div style={{
          position: 'absolute', inset: '10%',
          border: `1.5px solid ${color}33`,
          borderRadius: 4,
        }} />
        <span style={{
          fontSize: '1.6rem', color, lineHeight: 1, fontWeight: 900,
          fontFamily: 'serif',
          textShadow: `0 1px 2px ${color}44`,
        }}>
          {rank}
        </span>
        <span style={{ fontSize: '0.75rem', color: color + '99', lineHeight: 1 }}>{sym}</span>
      </div>
    );
  }

  const count = parseInt(rank) || 0;

  const getRows = (n: number): number[][] => {
    const layouts: Record<number, number[][]> = {
      3:  [[1], [1], [1]],
      4:  [[2], [0], [2]],
      5:  [[2], [1], [2]],
      6:  [[2], [2], [2]],
      7:  [[2], [1], [2], [2]],
      8:  [[2], [2], [2], [2]],
      9:  [[2], [2], [1], [2], [2]],
      10: [[2], [2], [2], [2], [2]],
    };
    return layouts[n] || [[1]];
  };

  const rows = getRows(count);
  const fontSize = count <= 6 ? '0.95rem' : count <= 8 ? '0.82rem' : '0.72rem';

  return (
    <div style={{
      position: 'absolute',
      inset: '18% 12%',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      alignItems: 'center',
    }}>
      {rows.map((row, ri) => (
        <div key={ri} style={{
          display: 'flex',
          justifyContent: row[0] === 0 ? 'center' : 'space-between',
          width: '100%',
        }}>
          {row[0] === 0 ? null : Array.from({ length: row[0] }).map((_, ci) => (
            <span key={ci} style={{
              fontSize,
              color,
              lineHeight: 1,
              transform: ri >= Math.floor(rows.length / 2) ? 'rotate(180deg)' : 'none',
              display: 'block',
            }}>
              {sym}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
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
  dimIfNotPlayable = true,
}: CardProps) {
  const isThreeOfSpades = card.suit === 'spades' && card.rank === '3';
  const color = SUIT_COLORS[card.suit];
  const sym = SUIT_SYMBOLS[card.suit];

  if (faceDown) {
    return (
      <motion.div
        layoutId={animate ? `card-${card.id}` : undefined}
        className={clsx(
          'relative rounded-lg overflow-hidden select-none',
          small ? 'w-10 h-[60px]' : 'w-14 h-[84px] sm:w-16 sm:h-[96px]',
          className
        )}
        style={{
          background: 'linear-gradient(145deg, #1a2850 0%, #1e3570 55%, #243f8a 100%)',
          border: '1px solid rgba(100,140,255,0.45)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.6)',
        }}
      >
        <div style={{
          position: 'absolute', inset: 3, borderRadius: 4,
          border: '1px solid rgba(100,140,255,0.22)',
          backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(255,255,255,0.03) 4px, rgba(255,255,255,0.03) 8px)',
        }} />
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontSize: small ? '1rem' : '1.4rem', color: 'rgba(100,140,255,0.4)' }}>♠</span>
        </div>
      </motion.div>
    );
  }

  const cardWidth = small ? '40px' : 'clamp(52px, 7vw, 64px)';
  const cardHeight = small ? '60px' : 'clamp(76px, 10.5vw, 96px)';

  return (
    <motion.div
      layoutId={animate ? `card-${card.id}` : undefined}
      className={clsx(
        'relative rounded-lg select-none',
        !playable && !selected && dimIfNotPlayable && 'opacity-60',
        className
      )}
      style={{
        width: cardWidth,
        height: cardHeight,
        background: '#ffffff',
        border: isThreeOfSpades
          ? '2px solid #d4a017'
          : selected
          ? '2px solid #38bdf8'
          : '1.5px solid #d0d0d0',
        boxShadow: isThreeOfSpades
          ? '0 0 0 1px rgba(212,160,23,0.4), 0 0 16px rgba(212,160,23,0.5), 0 4px 16px rgba(0,0,0,0.4)'
          : selected
          ? '0 0 0 1px rgba(56,189,248,0.5), 0 0 14px rgba(56,189,248,0.4), 0 6px 20px rgba(0,0,0,0.4)'
          : '0 3px 10px rgba(0,0,0,0.35), 0 1px 3px rgba(0,0,0,0.2)',
        cursor: playable ? 'pointer' : 'default',
        overflow: 'hidden',
        flexShrink: 0,
      }}
      onClick={playable || selected ? onClick : undefined}
      animate={flat ? {} : { y: selected ? -14 : 0 }}
      whileHover={(!flat && playable) ? { scale: 1.06, y: selected ? -18 : -5, transition: { type: 'spring', stiffness: 400, damping: 25 } } : {}}
      whileTap={(!flat && playable) ? { scale: 0.97 } : {}}
    >
      {/* Top-left corner: rank + suit */}
      <div style={{
        position: 'absolute', top: 3, left: 4,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        lineHeight: 1.1,
      }}>
        <span style={{
          fontSize: small ? '0.6rem' : '0.72rem',
          fontWeight: 800,
          color,
          lineHeight: 1,
          fontFamily: 'system-ui, sans-serif',
        }}>{card.rank}</span>
        <span style={{
          fontSize: small ? '0.55rem' : '0.65rem',
          color,
          lineHeight: 1,
        }}>{sym}</span>
      </div>

      {/* Bottom-right corner: rank + suit (rotated 180°) */}
      <div style={{
        position: 'absolute', bottom: 3, right: 4,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        lineHeight: 1.1,
        transform: 'rotate(180deg)',
      }}>
        <span style={{
          fontSize: small ? '0.6rem' : '0.72rem',
          fontWeight: 800,
          color,
          lineHeight: 1,
          fontFamily: 'system-ui, sans-serif',
        }}>{card.rank}</span>
        <span style={{
          fontSize: small ? '0.55rem' : '0.65rem',
          color,
          lineHeight: 1,
        }}>{sym}</span>
      </div>

      {/* Center pip area */}
      {!small && <PipGrid rank={card.rank} suit={card.suit} color={color} />}

      {/* Small card — just center symbol */}
      {small && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontSize: '1rem', color, lineHeight: 1 }}>{sym}</span>
        </div>
      )}

      {/* 3 of Spades gold shimmer overlay */}
      {isThreeOfSpades && (
        <>
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(135deg, rgba(212,160,23,0.08) 0%, transparent 50%, rgba(212,160,23,0.12) 100%)',
            pointerEvents: 'none',
          }} />
          <div style={{
            position: 'absolute', top: 0, right: 0,
            background: '#d4a017',
            color: '#fff',
            fontSize: '0.5rem',
            fontWeight: 900,
            padding: '2px 4px',
            borderBottomLeftRadius: 4,
            lineHeight: 1,
          }}>30</div>
        </>
      )}

      {/* Points badge for other scoring cards (not 3♠) */}
      {!isThreeOfSpades && card.points > 0 && !small && (
        <div style={{
          position: 'absolute', top: 0, right: 0,
          background: 'rgba(212,160,23,0.85)',
          color: '#fff',
          fontSize: '0.45rem',
          fontWeight: 900,
          padding: '1px 3px',
          borderBottomLeftRadius: 3,
          lineHeight: 1.2,
        }}>{card.points}</div>
      )}
    </motion.div>
  );
}
