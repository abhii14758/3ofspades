'use client';
import { motion } from 'framer-motion';

interface DealerFigureProps {
  isDealing: boolean;
}

export default function DealerFigure({ isDealing }: DealerFigureProps) {
  return (
    <motion.div
      className="flex flex-col items-center select-none pointer-events-none"
      animate={{ y: isDealing ? [0, -4, 0] : [0, -2, 0] }}
      transition={{ repeat: Infinity, duration: isDealing ? 0.6 : 3, ease: 'easeInOut' }}
    >
      {/* Dealer label */}
      <div
        className="mb-1 text-[9px] font-black tracking-widest uppercase"
        style={{ color: '#d4a017', textShadow: '0 0 6px rgba(212,160,23,0.5)' }}
      >
        Dealer
      </div>

      {/* SVG Character */}
      <svg
        width="52"
        height="72"
        viewBox="0 0 52 72"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Head */}
        <circle cx="26" cy="14" r="11" fill="#f5cba7" stroke="#d4a574" strokeWidth="1" />

        {/* Eyes */}
        <circle cx="22" cy="13" r="1.5" fill="#2c1810" />
        <circle cx="30" cy="13" r="1.5" fill="#2c1810" />

        {/* Smile */}
        <path d="M22 17 Q26 20 30 17" stroke="#2c1810" strokeWidth="1" strokeLinecap="round" fill="none" />

        {/* Dealer visor */}
        <path d="M15 11 Q26 6 37 11" fill="#1a6b2a" stroke="#0f4a1e" strokeWidth="1" />
        <path d="M15 11 Q26 9 37 11 L38 13 Q26 11 14 13 Z" fill="#d4a017" />

        {/* Shirt collar */}
        <path d="M21 24 L26 28 L31 24 L28 25 L26 30 L24 25 Z" fill="white" stroke="#ccc" strokeWidth="0.5" />

        {/* Bow tie */}
        <path d="M22 25 L25 27 L22 29 Z" fill="#1a1a2e" stroke="#333" strokeWidth="0.5" />
        <path d="M30 25 L27 27 L30 29 Z" fill="#1a1a2e" stroke="#333" strokeWidth="0.5" />
        <circle cx="26" cy="27" r="1.5" fill="#1a1a2e" />

        {/* Vest / body */}
        <path d="M16 24 Q14 36 15 48 L37 48 Q38 36 36 24 Q31 22 26 22 Q21 22 16 24 Z" fill="#1a1a2e" />
        {/* Vest lapels */}
        <path d="M21 24 L20 32 L26 30 Z" fill="#2a2a4e" />
        <path d="M31 24 L32 32 L26 30 Z" fill="#2a2a4e" />
        {/* White shirt center */}
        <path d="M24 30 L26 48 L28 30 Z" fill="white" opacity="0.6" />

        {/* Left arm (static) */}
        <path d="M16 26 Q10 32 11 40" stroke="#1a1a2e" strokeWidth="7" strokeLinecap="round" />
        <ellipse cx="11" cy="41" rx="4" ry="3" fill="#f5cba7" />

        {/* Right arm — animated during dealing */}
        <motion.g
          animate={isDealing
            ? { rotate: [-10, -55, -10] }
            : { rotate: [0, 5, 0] }
          }
          transition={isDealing
            ? { repeat: Infinity, duration: 0.7, ease: 'easeInOut' }
            : { repeat: Infinity, duration: 3, ease: 'easeInOut' }
          }
          style={{ transformOrigin: '36px 26px' }}
        >
          <path d="M36 26 Q42 32 41 40" stroke="#1a1a2e" strokeWidth="7" strokeLinecap="round" />
          <ellipse cx="41" cy="41" rx="4" ry="3" fill="#f5cba7" />
          {isDealing && (
            <motion.rect
              x="39" y="38" width="10" height="14" rx="1"
              fill="white" stroke="#1e3a8a" strokeWidth="1"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 1, 0] }}
              transition={{ repeat: Infinity, duration: 0.7 }}
            />
          )}
        </motion.g>

        {/* Legs */}
        <path d="M20 48 Q19 60 20 68" stroke="#1a1a2e" strokeWidth="6" strokeLinecap="round" />
        <path d="M32 48 Q33 60 32 68" stroke="#1a1a2e" strokeWidth="6" strokeLinecap="round" />
        {/* Shoes */}
        <ellipse cx="20" cy="68" rx="5" ry="3" fill="#111" />
        <ellipse cx="32" cy="68" rx="5" ry="3" fill="#111" />
      </svg>
    </motion.div>
  );
}
