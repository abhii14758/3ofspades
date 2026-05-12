'use client';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import type { Player, Card as CardType } from '@/types';
import CardBack from '@/components/cards/CardBack';
import Card from '@/components/cards/Card';

interface PlayerSeatProps {
  player: Player;
  cardCount: number;
  isCurrentTurn: boolean;
  isLocalPlayer: boolean;
  isPartner: boolean;
  isRevealed: boolean;
  isBidWinner?: boolean;
  trickCard?: CardType | null;
  position: 'bottom' | 'top' | 'left' | 'right' | 'top-left' | 'top-right';
  compact?: boolean;
  displayPoints?: number | null;
  teamId?: 'A' | 'B' | null;
  turnTimerEndsAt?: number | null;
  turnTimerTotalSeconds?: number;
  showCombinedLabel?: boolean;
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


/** Shrinking SVG arc timer around the avatar */
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
    const id = setInterval(update, 250);
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
      {/* Track */}
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3"
      />
      {/* Progress arc */}
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none"
        stroke={color}
        strokeWidth="3"
        strokeDasharray={circumference}
        strokeDashoffset={dashOffset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 0.25s linear, stroke 0.3s' }}
      />
    </svg>
  );
}

export default function PlayerSeat({
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
}: PlayerSeatProps) {
  const isDisconnected = player.status === 'disconnected';
  const gradient = isLocalPlayer
    ? 'from-sky-500 to-blue-600'
    : AVATAR_GRADIENTS[nameHash(player.name) % AVATAR_GRADIENTS.length];

  const isTeamA = isBidWinner || (isRevealed && isPartner);
  const scoreColor = isTeamA ? 'text-sky-400' : showCombinedLabel ? 'text-orange-400' : 'text-slate-400';

  // Flat horizontal card backs — no tilt, just a compact row
  const maxVisible = compact ? Math.min(cardCount, 4) : Math.min(cardCount, 8);

  return (
    <div
      className={clsx(
        'flex flex-col items-center gap-1 transition-opacity duration-300',
        isDisconnected && 'opacity-40'
      )}
    >
      {/* Flat card backs (hidden for local player and in compact mode) */}
      {!isLocalPlayer && !compact && cardCount > 0 && (
        <div className="flex items-center gap-0.5">
          {Array.from({ length: maxVisible }).map((_, i) => (
            <div key={i}>
              <CardBack small />
            </div>
          ))}
          {cardCount > maxVisible && (
            <span className="text-[9px] text-slate-500 font-bold ml-0.5">+{cardCount - maxVisible}</span>
          )}
        </div>
      )}

      {/* Trick card played by this player */}
      {!compact && (
        <AnimatePresence>
          {trickCard && (
            <motion.div
              key={trickCard.id}
              initial={{ scale: 0.5, opacity: 0, y: -20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 350, damping: 25 }}
              className="drop-shadow-lg"
            >
              <Card card={trickCard} small playable={false} />
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* Avatar with turn indicator and timer ring */}
      <div className="relative mt-1" style={{ width: 48, height: 48 }}>
        {/* Turn glow */}
        {isCurrentTurn && (
          <>
            <motion.div
              className="absolute rounded-full"
              style={{ inset: -10, background: 'radial-gradient(circle, rgba(74,222,128,0.4) 0%, transparent 70%)' }}
              animate={{ opacity: [0.4, 0.9, 0.4], scale: [0.95, 1.05, 0.95] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
            <motion.div
              className="absolute rounded-full"
              style={{ inset: -6, border: '2px solid rgba(74,222,128,0.8)', boxShadow: '0 0 12px rgba(74,222,128,0.5)' }}
              animate={{ opacity: [0.8, 0.3, 0.8] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
          </>
        )}

        {/* Timer ring — shown when it's this player's turn and timer is active */}
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
        <div style={{
          padding: '3px',
          borderRadius: '50%',
          background: isCurrentTurn
            ? 'linear-gradient(135deg, rgba(34,197,94,0.25), rgba(0,0,0,0.8))'
            : 'rgba(0,0,0,0.7)',
          boxShadow: isCurrentTurn
            ? '0 0 0 2px rgba(34,197,94,0.7), 0 0 16px rgba(34,197,94,0.4), 0 4px 12px rgba(0,0,0,0.9)'
            : isPartner && isRevealed
            ? '0 0 0 2px rgba(52,211,153,0.6), 0 4px 12px rgba(0,0,0,0.8)'
            : '0 0 0 1px rgba(255,255,255,0.08), 0 4px 12px rgba(0,0,0,0.8)',
        }}>
        <motion.div
          className={clsx(
            'w-12 h-12 rounded-full bg-gradient-to-br flex items-center justify-center font-bold text-sm uppercase shadow-md text-white relative overflow-hidden',
            gradient,
            isCurrentTurn && 'ring-2 ring-green-400 ring-offset-1 ring-offset-slate-900',
            isPartner && isRevealed && !isCurrentTurn && 'ring-2 ring-emerald-400 ring-offset-1 ring-offset-slate-900'
          )}
          animate={
            isCurrentTurn
              ? { boxShadow: ['0 0 4px rgba(74,222,128,0.3)', '0 0 16px rgba(74,222,128,0.8)', '0 0 4px rgba(74,222,128,0.3)'] }
              : isPartner && isRevealed
                ? { boxShadow: '0 0 8px rgba(52,211,153,0.5)' }
                : {}
          }
          transition={isCurrentTurn ? { duration: 1.3, repeat: Infinity } : {}}
        >
          {player.avatarUrl ? (
            <img src={player.avatarUrl} alt={player.name} className="absolute inset-0 w-full h-full object-cover rounded-full" />
          ) : (
            <span className="relative z-10">{player.name.charAt(0)}</span>
          )}
          {player.type === 'bot' && (
            <span className="absolute -bottom-0.5 -right-0.5 text-xs leading-none bg-slate-800 rounded-full px-0.5 z-20">
              🤖
            </span>
          )}
        </motion.div>
        </div>

        {player.isHost && (
          <span className="absolute -top-1 -right-1 text-xs leading-none">👑</span>
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
        <div className="flex items-center gap-1 flex-wrap justify-center">
          <span
            className={clsx(
              'rounded px-2 py-0.5 font-bold text-xs truncate max-w-[80px]',
              isLocalPlayer
                ? 'bg-sky-900/80 border border-sky-600/50 text-sky-200'
                : isCurrentTurn
                ? 'bg-green-950/90 border border-green-600/60 text-green-300'
                : 'text-slate-100',
              isDisconnected && 'line-through text-slate-500'
            )}
            style={!isLocalPlayer && !isCurrentTurn ? {
              background: 'linear-gradient(135deg, rgba(30,20,5,0.92), rgba(10,7,2,0.95))',
              border: '1px solid rgba(212,160,23,0.35)',
              boxShadow: '0 1px 4px rgba(0,0,0,0.5)',
            } : undefined}
            title={player.name}
          >
            {player.name}
          </span>
          {isBidWinner && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="text-xs font-bold bg-amber-600 text-white px-1 rounded"
              title="Bid winner – Team A lead"
            >
              👑 Lead
            </motion.span>
          )}
          {isPartner && isRevealed && !isBidWinner && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="text-xs font-bold bg-emerald-600 text-white px-1 rounded"
            title="Partner revealed"
          >
            🤝 Partner
          </motion.span>
          )}
          {showCombinedLabel && !isLocalPlayer && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="text-xs font-bold bg-orange-700 text-white px-1 rounded"
              title="Team B ally"
            >
              🤝 Ally
            </motion.span>
          )}
        </div>

        {/* Score (individual until partners revealed; combined for Team A after reveal) */}
        {displayPoints !== null && (
          <span className={clsx(
            'text-xs font-bold tabular-nums',
            displayPoints < 0 ? 'text-red-400' : scoreColor
          )}>
            {displayPoints < 0 ? `−${Math.abs(displayPoints)}` : displayPoints} pts
            {isTeamA && <span className="text-[9px] ml-0.5 opacity-70">(team A)</span>}
            {showCombinedLabel && !isTeamA && <span className="text-[9px] ml-0.5 opacity-70">(team B)</span>}
          </span>
        )}

        {isDisconnected && (
          <span className="text-[11px] text-yellow-500 font-medium">⚡ DC</span>
        )}

        {isLocalPlayer && !isDisconnected && (
          <span className="text-[11px] text-slate-500 font-medium">You</span>
        )}

        {/* Card count badge in normal mode */}
        {!compact && !isLocalPlayer && cardCount > 0 && (
          <span className="bg-slate-900/90 text-slate-300 text-xs font-bold px-1.5 py-0.5 rounded-full border border-slate-700">
            {cardCount}
          </span>
        )}
      </div>
    </div>
  );
}
