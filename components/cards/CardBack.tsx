'use client';
import clsx from 'clsx';

interface CardBackProps {
  small?: boolean;
  className?: string;
}

export default function CardBack({ small = false, className }: CardBackProps) {
  return (
    <div
      className={clsx(
        'relative rounded-lg border-2 border-green-700 bg-green-900 overflow-hidden flex items-center justify-center select-none',
        small ? 'w-10 h-16' : 'w-16 h-24',
        className
      )}
    >
      {/* Outer decorative border */}
      <div className="absolute inset-1 rounded border border-green-700/60 pointer-events-none" />
      <div className="absolute inset-2 rounded border border-green-700/30 pointer-events-none" />

      {/* Grid dot pattern */}
      <div className="absolute inset-0 grid grid-cols-4 gap-px p-2 opacity-20 pointer-events-none">
        {Array.from({ length: 20 }).map((_, i) => (
          <div key={i} className="bg-green-400 rounded-full aspect-square" />
        ))}
      </div>

      {/* Center spade */}
      <span className={clsx('text-green-600/50 font-bold z-10', small ? 'text-lg' : 'text-2xl')}>
        ♠
      </span>

      {/* Corner dots */}
      <div className="absolute top-1 left-1 w-1 h-1 bg-green-500/40 rounded-full" />
      <div className="absolute top-1 right-1 w-1 h-1 bg-green-500/40 rounded-full" />
      <div className="absolute bottom-1 left-1 w-1 h-1 bg-green-500/40 rounded-full" />
      <div className="absolute bottom-1 right-1 w-1 h-1 bg-green-500/40 rounded-full" />
    </div>
  );
}
