'use client';
import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface BlackoutOverlayProps {
  visible: boolean;
  onReveal: () => void;
}

export default function BlackoutOverlay({ visible, onReveal }: BlackoutOverlayProps) {
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
          className="fixed inset-0 z-[9999] bg-black flex items-center justify-center select-none"
          style={{ touchAction: 'none' }}
        >
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
