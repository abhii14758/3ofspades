'use client';
import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface BlackoutOverlayProps {
  visible: boolean;
  onReveal: () => void;
  isHost?: boolean;
  blackoutCount?: number;
  blackoutVoterNames?: string[];
  totalPlayers?: number;
}

export default function BlackoutOverlay({
  visible,
  onReveal,
  isHost = false,
  blackoutCount = 0,
  blackoutVoterNames = [],
  totalPlayers = 0,
}: BlackoutOverlayProps) {
  useEffect(() => {
    if (!visible) return;
    const handler = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        onReveal();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [visible, onReveal]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="blackout"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[9999] bg-black flex flex-col items-center justify-center gap-6 select-none"
          style={{ touchAction: 'none' }}
        >
          {isHost && blackoutCount > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="flex flex-col items-center gap-2"
            >
              <div className="flex items-center gap-2 bg-slate-900/80 border border-amber-500/40 rounded-2xl px-5 py-3">
                <span className="text-amber-400 text-2xl font-black">{blackoutCount}</span>
                <span className="text-slate-300 text-sm">
                  {blackoutCount === 1 ? 'player' : 'players'} pressed ESC
                  {totalPlayers > 0 && <span className="text-slate-500"> / {totalPlayers}</span>}
                </span>
              </div>
              {blackoutVoterNames.length > 0 && (
                <div className="flex flex-wrap justify-center gap-1.5 max-w-xs">
                  {blackoutVoterNames.map((name) => (
                    <span key={name} className="text-xs bg-slate-800 border border-slate-700 text-slate-400 rounded-full px-2.5 py-0.5">
                      {name}
                    </span>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.25 }}
            transition={{ delay: 1.5, duration: 1 }}
            className="text-white text-sm tracking-widest uppercase font-light"
          >
            Press Space to reveal
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
