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
            className="px-5 py-1.5 rounded-full text-white font-bold text-sm tracking-wide"
            style={{
              background: 'linear-gradient(135deg, #16a34a 0%, #15803d 50%, #166534 100%)',
              border: '1px solid rgba(74,222,128,0.5)',
            }}
            initial={{ scale: 0.8 }}
            animate={{
              scale: [0.8, 1.04, 1],
              boxShadow: [
                '0 0 8px rgba(74,222,128,0.4), 0 2px 8px rgba(0,0,0,0.5)',
                '0 0 28px rgba(74,222,128,0.85), 0 2px 8px rgba(0,0,0,0.5)',
                '0 0 8px rgba(74,222,128,0.4), 0 2px 8px rgba(0,0,0,0.5)',
              ],
            }}
            transition={{
              scale: { duration: 0.45, times: [0, 0.6, 1] },
              boxShadow: { duration: 1.4, repeat: Infinity },
            }}
          >
            ✨ Your Turn!
          </motion.div>
        ) : (
          <div
            className="px-4 py-1.5 rounded-full text-slate-300 text-sm"
            style={{
              background: 'rgba(15,20,15,0.85)',
              border: '1px solid rgba(100,120,100,0.3)',
              boxShadow: '0 1px 6px rgba(0,0,0,0.5)',
            }}
          >
            🎯 <span className="text-slate-100 font-semibold">{currentPlayer.name}</span>&apos;s Turn
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
