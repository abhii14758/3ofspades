'use client';
import { motion, AnimatePresence } from 'framer-motion';
import type { Player } from '@/types';

interface TurnIndicatorProps {
  currentPlayer: Player | null;
  isMyTurn: boolean;
}

export default function TurnIndicator({ currentPlayer, isMyTurn }: TurnIndicatorProps) {
  if (!currentPlayer) return null;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={currentPlayer.id}
        initial={{ opacity: 0, y: -12, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -12, scale: 0.95 }}
        transition={{ duration: 0.25 }}
        className="flex justify-center w-full"
      >
        {isMyTurn ? (
          <motion.div
            className="px-6 py-2 rounded-full bg-gradient-to-r from-green-600 to-emerald-600 text-white font-bold text-sm tracking-wide shadow-lg"
            initial={{ scale: 0.8 }}
            animate={{
              scale: [0.8, 1.05, 1],
              boxShadow: [
                '0 0 8px rgba(74,222,128,0.4)',
                '0 0 24px rgba(74,222,128,0.8)',
                '0 0 8px rgba(74,222,128,0.4)',
              ],
            }}
            transition={{
              scale: { duration: 0.5, times: [0, 0.6, 1] },
              boxShadow: { duration: 1.5, repeat: Infinity },
            }}
          >
            ✨ Your Turn!
          </motion.div>
        ) : (
          <div className="px-5 py-2 rounded-full bg-slate-800/90 border border-slate-600/60 shadow-md text-slate-300 text-sm">
            🎯 <span className="text-slate-100 font-semibold">{currentPlayer.name}</span>&apos;s Turn
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
