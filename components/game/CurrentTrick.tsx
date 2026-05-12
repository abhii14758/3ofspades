'use client';
import { motion, AnimatePresence } from 'framer-motion';
import { PlayingCard } from '@/components/ui/PlayingCard';
import type { GameState, Player } from '@/types';

interface CurrentTrickProps {
  gameState: GameState;
  myPlayerId: string;
}

export function CurrentTrick({ gameState, myPlayerId }: CurrentTrickProps) {
  const trick = gameState.currentTrick;

  if (!trick || trick.cards.length === 0) {
    return (
      <div className="flex items-center justify-center w-44 h-32 rounded-xl border-2 border-dashed border-green-900/60 text-green-900 text-xs">
        Waiting…
      </div>
    );
  }

  return (
    <div className="relative w-52 h-44 flex items-center justify-center">
      <AnimatePresence>
        {trick.cards.map((entry, i) => {
          const player = gameState.players.find(
            (p: Player) => p.id === entry.playerId,
          );
          const offsetX = (i - (trick.cards.length - 1) / 2) * 14;
          const offsetY = (i % 2) * -10;

          return (
            <motion.div
              key={entry.card.id}
              initial={{ scale: 0, y: -30, opacity: 0 }}
              animate={{ scale: 1, y: offsetY, x: offsetX, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              className="absolute"
              style={{ zIndex: i }}
            >
              <div className="relative">
                <PlayingCard card={entry.card} />
                <div className="absolute -bottom-5 left-0 right-0 text-center text-[10px] text-slate-400 truncate">
                  {entry.playerId === myPlayerId ? 'You' : (player?.name ?? '?')}
                </div>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
