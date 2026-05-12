'use client';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
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
            className="px-5 py-2 rounded-full bg-green-600/90 border border-green-400 shadow-lg shadow-green-900/60 text-white font-bold text-sm tracking-wide"
            animate={{ boxShadow: ['0 0 8px rgba(74,222,128,0.4)', '0 0 20px rgba(74,222,128,0.7)', '0 0 8px rgba(74,222,128,0.4)'] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            ✨ Your Turn!
          </motion.div>
        ) : (
          <div className="px-5 py-2 rounded-full bg-slate-800/90 border border-slate-600 shadow-md text-slate-300 font-medium text-sm">
            {currentPlayer.name}&apos;s Turn
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
