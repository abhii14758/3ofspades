'use client';
import clsx from 'clsx';

interface CardBackProps {
  small?: boolean;
  className?: string;
}

export default function CardBack({ small = false, className }: CardBackProps) {
  const w = small ? '40px' : '64px';
  const h = small ? '60px' : '96px';

  return (
    <div
      className={clsx('relative rounded-lg select-none overflow-hidden', className)}
      style={{
        width: w, height: h,
        background: 'linear-gradient(145deg, #1a2850 0%, #1e3570 55%, #243f8a 100%)',
        border: '1.5px solid rgba(100,140,255,0.45)',
        boxShadow: '0 3px 10px rgba(0,0,0,0.5)',
        flexShrink: 0,
      }}
    >
      <div style={{
        position: 'absolute', inset: 3, borderRadius: 4,
        border: '1px solid rgba(100,140,255,0.25)',
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
          color: 'rgba(100,140,255,0.35)',
          lineHeight: 1,
        }}>♠</span>
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
            background: 'rgba(100,140,255,0.3)',
          }} />
        );
      })}
    </div>
  );
}
