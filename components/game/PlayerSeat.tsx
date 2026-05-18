'use client';
import { memo, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import type { Player, Card as CardType } from '@/types';

interface PlayerSeatProps {
  player: Player;
  cardCount: number;
  isCurrentTurn: boolean;
  isLocalPlayer: boolean;
  isPartner: boolean;
  isRevealed: boolean;
  isBidWinner?: boolean;
  trickCard?: CardType | null;
  position?: 'bottom' | 'top' | 'left' | 'right' | 'top-left' | 'top-right';
  compact?: boolean;
  displayPoints?: number | null;
  teamId?: 'A' | 'B' | null;
  turnTimerEndsAt?: number | null;
  turnTimerTotalSeconds?: number;
  showCombinedLabel?: boolean;
  extraCompact?: boolean;
  miniCardCount?: number;
}

const AVATAR_GRADIENTS = [
  'from-purple-600 to-indigo-700',
  'from-blue-600 to-cyan-600',
  'from-emerald-600 to-teal-600',
  'from-orange-600 to-red-600',
  'from-pink-600 to-rose-600',
  'from-amber-500 to-orange-600',
  'from-sky-500 to-blue-600',
  'from-violet-600 to-purple-700',
];

function nameHash(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return h;
}

/** Shrinking SVG arc timer around the avatar — slowed to 1000ms to reduce re-renders */
function TimerRing({
  endsAt,
  totalSeconds = 30,
  size = 52,
}: {
  endsAt: number;
  totalSeconds?: number;
  size?: number;
}) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    const update = () => setRemaining(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)));
    update();
    const id = setInterval(update, 1000); // reduced from 250ms → 1000ms
    return () => clearInterval(id);
  }, [endsAt]);

  const radius = (size - 6) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(remaining / totalSeconds, 1);
  const dashOffset = circumference * (1 - progress);
  const color = remaining < 5 ? '#ef4444' : remaining < 20 ? '#f59e0b' : '#22c55e';

  return (
    <svg
      width={size}
      height={size}
      className="absolute inset-0 -translate-x-[1px] -translate-y-[1px]"
      style={{ pointerEvents: 'none' }}
      viewBox={`0 0 ${size} ${size}`}
    >
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3"
      />
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none"
        stroke={color}
        strokeWidth="3"
        strokeDasharray={circumference}
        strokeDashoffset={dashOffset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s' }}
      />
    </svg>
  );
}

function PlayerSeat({
  player,
  cardCount,
  isCurrentTurn,
  isLocalPlayer,
  isPartner,
  isRevealed,
  isBidWinner = false,
  trickCard,
  position,
  compact = false,
  displayPoints = null,
  teamId = null,
  turnTimerEndsAt,
  turnTimerTotalSeconds = 30,
  showCombinedLabel = false,
  extraCompact = false,
  miniCardCount = 0,
}: PlayerSeatProps) {
  const isDisconnected = player.status === 'disconnected';
  const gradient = isLocalPlayer
    ? 'from-sky-500 to-blue-600'
    : AVATAR_GRADIENTS[nameHash(player.name) % AVATAR_GRADIENTS.length];

  const partnerRevealed = isPartner && isRevealed;

  const avatarSize = extraCompact ? 34 : 56;
  const avatarFontSize = extraCompact ? 10 : 16;

  const avatarBorder = isCurrentTurn
    ? '2.5px solid #00ffcc'
    : isLocalPlayer
    ? '2.5px solid #f9d976'
    : partnerRevealed
    ? '2.5px solid #34d399'
    : '2.5px solid #d4af37';

  const avatarBoxShadow = isCurrentTurn
    ? '0 0 0 4px rgba(0,255,204,.25), 0 0 14px rgba(0,255,204,.5)'
    : isLocalPlayer
    ? '0 0 0 3px rgba(249,217,118,.3)'
    : partnerRevealed
    ? '0 0 10px rgba(52,211,153,.45)'
    : undefined;

  const namePillColor = isCurrentTurn
    ? '#a7f3d0'
    : isLocalPlayer
    ? '#f9d976'
    : partnerRevealed
    ? '#6ee7b7'
    : '#e2d9c0';

  const namePillBorderColor = isCurrentTurn
    ? 'rgba(0,255,204,.4)'
    : isLocalPlayer
    ? 'rgba(249,217,118,.5)'
    : partnerRevealed
    ? 'rgba(52,211,153,.4)'
    : 'rgba(212,175,55,0.4)';

  return (
    <div
      className={clsx(
        'flex flex-col items-center gap-1 transition-opacity duration-300',
        isDisconnected && 'opacity-40'
      )}
    >
      {/* Avatar with timer ring */}
      <div className="relative mt-1" style={{ width: avatarSize, height: avatarSize }}>
        {/* Timer ring */}
        {isCurrentTurn && turnTimerEndsAt && (
          <div className="absolute" style={{ inset: -7 }}>
            <TimerRing
              endsAt={turnTimerEndsAt}
              totalSeconds={turnTimerTotalSeconds}
              size={54}
            />
          </div>
        )}

        {/* Avatar circle */}
        <div
          className={clsx(
            'rounded-full bg-gradient-to-br flex items-center justify-center font-black uppercase text-white relative',
            isCurrentTurn && 'av-pulse',
            gradient
          )}
          style={{
            width: avatarSize,
            height: avatarSize,
            fontSize: avatarFontSize,
            border: avatarBorder,
            boxShadow: avatarBoxShadow,
            flexShrink: 0,
            overflow: 'hidden',
          }}
        >
          {player.avatarUrl ? (
            <img src={player.avatarUrl} alt={player.name} className="absolute inset-0 w-full h-full object-cover rounded-full" />
          ) : (
            <span className="relative z-10">{player.name.charAt(0)}</span>
          )}
          {player.type === 'bot' && (
            <span className="absolute -bottom-0.5 -right-0.5 text-xs leading-none bg-slate-800 rounded-full px-0.5 z-20">
              {player.isSubstitutedBot ? '🔄' : '🤖'}
            </span>
          )}
        </div>

        {player.isHost && (
          <span style={{ position: 'absolute', top: -9, right: -4, fontSize: 10, lineHeight: 1 }}>👑</span>
        )}

        {/* Card count badge in compact mode */}
        {compact && !isLocalPlayer && cardCount > 0 && (
          <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-slate-900/90 text-slate-300 text-xs font-bold px-1 rounded-full leading-tight border border-slate-700">
            {cardCount}
          </span>
        )}
      </div>

      {/* Name + score + badges */}
      <div className="flex flex-col items-center gap-0.5">
        {/* Name pill */}
        <div
          style={{
            background: 'rgba(0,0,0,.75)',
            borderRadius: 10,
            padding: '3px 9px',
            fontSize: 11,
            fontWeight: 700,
            whiteSpace: 'nowrap',
            maxWidth: 80,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            border: `1px solid ${namePillBorderColor}`,
            color: namePillColor,
            lineHeight: 1.4,
            textDecoration: isDisconnected ? 'line-through' : undefined,
          }}
          title={player.name}
        >
          {player.name}
        </div>

        {/* Points */}
        {displayPoints !== null && (
          <div style={{ fontSize: 11, fontWeight: 800, color: displayPoints < 0 ? '#f87171' : '#4ade80' }}>
            {displayPoints > 0 ? '+' : ''}{displayPoints} pts
          </div>
        )}

        {/* Badges */}
        {isBidWinner && (
          <div style={{ fontSize: 10, color: '#f9d976' }}>Bid Won</div>
        )}
        {isPartner && isRevealed && !isBidWinner && (
          <div style={{ fontSize: 10, color: '#6ee7b7' }}>🤝 Partner</div>
        )}
        {player.isSubstitutedBot && (
          <div style={{ fontSize: 8, color: '#fbbf24' }}>BOT</div>
        )}

        {/* Mini-hand cards for opponents */}
        {!isLocalPlayer && miniCardCount > 0 && (
          <div style={{ display: 'flex', gap: 2, marginTop: 1 }}>
            {Array.from({ length: Math.min(miniCardCount, 5) }).map((_, i) => (
              <div key={i} style={{
                width: 16,
                height: 22,
                borderRadius: 2,
                flexShrink: 0,
                background: 'linear-gradient(135deg,#1e3a8a 0%,#1e40af 55%,#2563eb 100%)',
                border: '1.5px solid rgba(147,197,253,.4)',
              }} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(PlayerSeat);
