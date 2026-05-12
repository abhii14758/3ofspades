'use client';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import type { Player } from '@/types';
import Button from '@/components/ui/Button';

interface PlayerListProps {
  players: Player[];
  localPlayerId: string;
  onToggleReady?: () => void;
  isReady?: boolean;
}

export default function PlayerList({
  players,
  localPlayerId,
  onToggleReady,
  isReady = false,
}: PlayerListProps) {
  const readyCount = players.filter((p) => p.status === 'ready' || p.type === 'bot').length;

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-xl overflow-hidden w-full max-w-md">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/60 bg-slate-800/50">
        <div>
          <h3 className="text-slate-100 font-bold text-base">Players</h3>
          <p className="text-slate-500 text-xs mt-0.5">
            {players.length}/6 joined · {readyCount} ready
          </p>
        </div>
        <div className="flex gap-1.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className={clsx(
                'w-2 h-2 rounded-full transition-colors duration-300',
                i < players.length ? 'bg-green-500' : 'bg-slate-700'
              )}
            />
          ))}
        </div>
      </div>

      {/* Players list */}
      <div className="divide-y divide-slate-700/40">
        <AnimatePresence initial={false}>
          {players.map((player) => {
            const isLocal = player.id === localPlayerId;
            const isBot = player.type === 'bot';
            const ready = player.status === 'ready' || isBot;

            return (
              <motion.div
                key={player.id}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 16 }}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                className={clsx(
                  'flex items-center gap-3 px-5 py-3.5 transition-colors',
                  isLocal ? 'bg-sky-900/20' : 'hover:bg-slate-800/40'
                )}
              >
                {/* Avatar */}
                <div
                  className={clsx(
                    'w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm uppercase shrink-0 shadow',
                    isLocal
                      ? 'bg-sky-700 text-sky-100 ring-2 ring-sky-500'
                      : isBot
                        ? 'bg-violet-800 text-violet-200'
                        : 'bg-slate-700 text-slate-200'
                  )}
                >
                  {isBot ? '🤖' : player.name.charAt(0)}
                </div>

                {/* Name & badges */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={clsx(
                        'font-semibold text-sm truncate',
                        isLocal ? 'text-sky-200' : 'text-slate-200'
                      )}
                    >
                      {player.name}
                    </span>
                    {isLocal && (
                      <span className="text-[10px] bg-sky-700/60 text-sky-300 px-1.5 py-0.5 rounded font-medium">
                        You
                      </span>
                    )}
                    {player.isHost && (
                      <span className="text-[10px] bg-yellow-700/40 text-yellow-400 px-1.5 py-0.5 rounded font-medium">
                        👑 Host
                      </span>
                    )}
                    {isBot && (
                      <span className="text-[10px] bg-violet-800/50 text-violet-300 px-1.5 py-0.5 rounded font-medium">
                        BOT
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Seat {player.seatIndex + 1}
                  </p>
                </div>

                {/* Ready badge */}
                <div className="shrink-0">
                  {ready ? (
                    <span className="inline-flex items-center gap-1 text-xs bg-green-800/50 text-green-300 border border-green-700/50 px-2.5 py-1 rounded-full font-medium">
                      ✓ Ready
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs bg-yellow-900/30 text-yellow-500 border border-yellow-800/40 px-2.5 py-1 rounded-full font-medium">
                      ⏳ Waiting
                    </span>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* Empty seats */}
        {Array.from({ length: Math.max(0, 6 - players.length) }).map((_, i) => (
          <div
            key={`empty-${i}`}
            className="flex items-center gap-3 px-5 py-3.5 opacity-30"
          >
            <div className="w-9 h-9 rounded-full border-2 border-dashed border-slate-600 flex items-center justify-center">
              <span className="text-slate-600 text-xs">?</span>
            </div>
            <span className="text-slate-600 text-sm italic">Waiting for player…</span>
          </div>
        ))}
      </div>

      {/* Ready toggle (local player) */}
      {onToggleReady && (
        <div className="px-5 py-4 border-t border-slate-700/60 bg-slate-800/30">
          <Button
            size="md"
            variant={isReady ? 'secondary' : 'primary'}
            className="w-full"
            onClick={onToggleReady}
          >
            {isReady ? '✓ Ready — Click to Unready' : 'Mark as Ready'}
          </Button>
        </div>
      )}
    </div>
  );
}
