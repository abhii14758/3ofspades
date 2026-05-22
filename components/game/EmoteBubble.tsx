'use client';
import { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getEmote } from '@/config/emotes';
import type { ActiveEmote } from '@/store/gameStore';

interface EmoteBubbleProps {
  activeEmote: ActiveEmote | undefined;
}

function EmoteBubble({ activeEmote }: EmoteBubbleProps) {
  if (!activeEmote) return null;

  const emote = getEmote(activeEmote.emote);

  return (
    <AnimatePresence>
      <motion.div
        key={activeEmote.timestamp}
        initial={{ opacity: 0, scale: 0.4 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.6 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        style={{
          position: 'absolute',
          bottom: '100%',
          left: '50%',
          marginLeft: -40,
          zIndex: 20,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          pointerEvents: 'none',
          marginBottom: 4,
        }}
      >
        {/* Emote bubble */}
        <div
          style={{
            background: 'rgba(10,10,20,0.92)',
            border: '1.5px solid rgba(212,175,55,0.5)',
            borderRadius: 12,
            padding: '4px 10px',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            boxShadow: '0 4px 16px rgba(0,0,0,0.5), 0 0 12px rgba(212,175,55,0.2)',
            whiteSpace: 'nowrap',
          }}
        >
          <span style={{ fontSize: 18, lineHeight: 1 }}>{emote.emoji}</span>
          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.65)', fontWeight: 700 }}>{emote.label}</span>
        </div>
        {/* Arrow pointing down */}
        <div
          style={{
            width: 0,
            height: 0,
            borderLeft: '5px solid transparent',
            borderRight: '5px solid transparent',
            borderTop: '5px solid rgba(212,175,55,0.5)',
            marginTop: -1,
          }}
        />
      </motion.div>
    </AnimatePresence>
  );
}

export default memo(EmoteBubble);
