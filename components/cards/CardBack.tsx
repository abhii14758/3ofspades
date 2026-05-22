'use client';
import clsx from 'clsx';
import { getCardBack } from '@/config/cardBacks';

interface CardBackProps {
  small?: boolean;
  className?: string;
  cardBackId?: string;
}

const BACK_STYLES: Record<string, { background: string; border: string; dot: string; icon: string }> = {
  default:  { background: 'linear-gradient(145deg, #1a2850 0%, #1e3570 55%, #243f8a 100%)', border: 'rgba(100,140,255,0.45)', dot: 'rgba(100,140,255,0.3)', icon: 'rgba(100,140,255,0.35)' },
  midnight: { background: 'linear-gradient(145deg, #1e1b4b 0%, #312e81 55%, #4338ca 100%)', border: 'rgba(129,140,248,0.45)', dot: 'rgba(129,140,248,0.3)', icon: 'rgba(129,140,248,0.35)' },
  royal:    { background: 'linear-gradient(145deg, #581c87 0%, #6b21a8 55%, #7e22ce 100%)', border: 'rgba(192,132,252,0.45)', dot: 'rgba(192,132,252,0.3)', icon: 'rgba(192,132,252,0.35)' },
  neon:     { background: 'linear-gradient(145deg, #065f46 0%, #047857 55%, #059669 100%)', border: 'rgba(52,211,153,0.45)', dot: 'rgba(52,211,153,0.3)', icon: 'rgba(52,211,153,0.35)' },
  galaxy:   { background: 'linear-gradient(145deg, #4c1d95 0%, #5b21b6 55%, #6d28d9 100%)', border: 'rgba(167,139,250,0.45)', dot: 'rgba(167,139,250,0.3)', icon: 'rgba(167,139,250,0.35)' },
  gold:     { background: 'linear-gradient(145deg, #92400e 0%, #b45309 55%, #d97706 100%)', border: 'rgba(251,191,36,0.45)', dot: 'rgba(251,191,36,0.3)', icon: 'rgba(251,191,36,0.35)' },
  frost:    { background: 'linear-gradient(145deg, #164e63 0%, #0e7490 55%, #0891b2 100%)', border: 'rgba(34,211,238,0.45)', dot: 'rgba(34,211,238,0.3)', icon: 'rgba(34,211,238,0.35)' },
  shadow:   { background: 'linear-gradient(145deg, #1f2937 0%, #374151 55%, #4b5563 100%)', border: 'rgba(156,163,175,0.45)', dot: 'rgba(156,163,175,0.3)', icon: 'rgba(156,163,175,0.35)' },
  cherry:   { background: 'linear-gradient(145deg, #9d174d 0%, #be185d 55%, #db2777 100%)', border: 'rgba(244,114,182,0.45)', dot: 'rgba(244,114,182,0.3)', icon: 'rgba(244,114,182,0.35)' },
  forest:   { background: 'linear-gradient(145deg, #14532d 0%, #166534 55%, #15803d 100%)', border: 'rgba(74,222,128,0.45)', dot: 'rgba(74,222,128,0.3)', icon: 'rgba(74,222,128,0.35)' },
  ocean:    { background: 'linear-gradient(145deg, #1e3a8a 0%, #1d4ed8 55%, #2563eb 100%)', border: 'rgba(96,165,250,0.45)', dot: 'rgba(96,165,250,0.3)', icon: 'rgba(96,165,250,0.35)' },
  ember:    { background: 'linear-gradient(145deg, #9a3412 0%, #c2410c 55%, #ea580c 100%)', border: 'rgba(251,146,60,0.45)', dot: 'rgba(251,146,60,0.3)', icon: 'rgba(251,146,60,0.35)' },
};

export default function CardBack({ small = false, className, cardBackId = 'default' }: CardBackProps) {
  const w = small ? '40px' : '64px';
  const h = small ? '60px' : '96px';
  const config = getCardBack(cardBackId);
  const style = BACK_STYLES[cardBackId] ?? BACK_STYLES['default'];

  return (
    <div
      className={clsx('relative rounded-lg select-none overflow-hidden', className)}
      style={{
        width: w, height: h,
        background: style.background,
        border: `1.5px solid ${style.border}`,
        boxShadow: '0 3px 10px rgba(0,0,0,0.5)',
        flexShrink: 0,
      }}
    >
      <div style={{
        position: 'absolute', inset: 3, borderRadius: 4,
        border: `1px solid ${style.border}`,
      }} />
      <div style={{
        position: 'absolute', inset: 4,
        backgroundImage: [
          'repeating-linear-gradient(45deg,',
          'transparent, transparent 4px,',
          'rgba(255,255,255,0.04) 4px, rgba(255,255,255,0.04) 8px)',
        ].join(' '),
        borderRadius: 3,
      }} />
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{
          fontSize: small ? '0.9rem' : '1.3rem',
          color: style.icon,
          lineHeight: 1,
        }}>{config.pattern}</span>
      </div>
      {(['3px 3px', '3px auto', 'auto 3px', 'auto auto'] as const).map((pos, i) => {
        const parts = pos.split(' ');
        const t = parts[0];
        const l = parts[1];
        return (
          <div key={i} style={{
            position: 'absolute',
            top: t === 'auto' ? undefined : t,
            bottom: t === 'auto' ? '3px' : undefined,
            left: l === 'auto' ? undefined : l,
            right: l === 'auto' ? '3px' : undefined,
            width: 3, height: 3, borderRadius: '50%',
            background: style.dot,
          }} />
        );
      })}
    </div>
  );
}
