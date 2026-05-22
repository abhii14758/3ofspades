'use client';
import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ALL_EMOTES, MAX_EQUIPPED_EMOTES } from '@/config/emotes';
import type { Emote } from '@/config/emotes';
import { socketEmit } from '@/lib/socket/socketClient';

interface EmoteWheelProps {
  roomId: string;
  /** Emote IDs the player has equipped. Falls back to ALL if empty. */
  equippedEmoteIds?: string[];
}

export default function EmoteWheel({ roomId, equippedEmoteIds = [] }: EmoteWheelProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Resolve which emotes to show: equipped subset, or first N from ALL_EMOTES
  const emotes: Emote[] = equippedEmoteIds.length > 0
    ? equippedEmoteIds
        .map(id => ALL_EMOTES.find(e => e.id === id))
        .filter((e): e is Emote => !!e)
        .slice(0, MAX_EQUIPPED_EMOTES)
    : ALL_EMOTES.slice(0, MAX_EQUIPPED_EMOTES);

  const handleSend = useCallback((emote: Emote) => {
    socketEmit.sendEmote(roomId, emote.id);
    setOpen(false);
  }, [roomId]);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  // Close after inactivity (10s)
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => setOpen(false), 10_000);
    return () => clearTimeout(t);
  }, [open]);

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(v => !v)}
        title="Send emote"
        style={{
          width: 44,
          height: 44,
          borderRadius: 8,
          border: open ? '1px solid rgba(212,175,55,0.6)' : '1px solid rgba(255,255,255,0.1)',
          background: open ? 'rgba(212,175,55,0.18)' : 'rgba(255,255,255,0.07)',
          color: '#fff',
          cursor: 'pointer',
          fontSize: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.15s',
        }}
      >
        😄
      </button>

      {/* Emote wheel popup */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: 10 }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            style={{
              position: 'absolute',
              bottom: '100%',
              right: 0,
              marginBottom: 8,
              background: 'rgba(10,10,20,0.95)',
              border: '1px solid rgba(212,175,55,0.4)',
              borderRadius: 14,
              padding: 10,
              zIndex: 300,
              display: 'grid',
              gridTemplateColumns: `repeat(${Math.min(emotes.length, 4)}, 1fr)`,
              gap: 6,
              boxShadow: '0 8px 32px rgba(0,0,0,0.6), 0 0 20px rgba(212,175,55,0.15)',
              backdropFilter: 'blur(12px)',
            }}
          >
            {emotes.map((emote) => (
              <button
                key={emote.id}
                onClick={() => handleSend(emote)}
                title={emote.label}
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 10,
                  border: '1px solid rgba(255,255,255,0.08)',
                  background: 'rgba(255,255,255,0.04)',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 2,
                  transition: 'all 0.12s',
                  padding: 2,
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = 'rgba(212,175,55,0.18)';
                  (e.currentTarget as HTMLElement).style.borderColor = 'rgba(212,175,55,0.5)';
                  (e.currentTarget as HTMLElement).style.transform = 'scale(1.1)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)';
                  (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)';
                  (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
                }}
              >
                <span style={{ fontSize: 22, lineHeight: 1 }}>{emote.emoji}</span>
                <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.5)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 44 }}>
                  {emote.label}
                </span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
