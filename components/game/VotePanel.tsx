'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { socketEmit } from '@/lib/socket/socketClient';

interface VotePanelProps {
  roomId: string;
  myPlayerId: string;
  voteEndVotes?: Record<string, boolean>;
  totalPlayers: number;
  onTerminated?: () => void;
}

export default function VotePanel({
  roomId,
  myPlayerId,
  voteEndVotes = {},
  totalPlayers,
  onTerminated: _onTerminated,
}: VotePanelProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [mounted, setMounted] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [popupStyle, setPopupStyle] = useState<{ top: number; right: number }>({ top: 0, right: 0 });

  useEffect(() => { setMounted(true); }, []);

  const hasVoted = voteEndVotes[myPlayerId] === true;
  const yesCount = Object.values(voteEndVotes).filter(Boolean).length;
  const threshold = Math.ceil(totalPlayers * 0.8);

  const openConfirm = () => {
    if (hasVoted) return;
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPopupStyle({
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right,
      });
    }
    setShowConfirm(true);
  };

  return (
    <>
      <button
        ref={buttonRef}
        onClick={openConfirm}
        disabled={hasVoted}
        className={`shrink-0 text-xs px-2.5 py-1.5 rounded-lg border font-semibold transition-all ${
          hasVoted
            ? 'bg-slate-800/50 border-slate-700/40 text-slate-500 cursor-default'
            : 'bg-red-950/70 hover:bg-red-900/80 border-red-800/60 text-red-300 hover:text-red-200 active:scale-95'
        }`}
        title={hasVoted ? `Voted (${yesCount}/${threshold} needed)` : 'Vote to end game'}
      >
        {hasVoted ? `✓ ${yesCount}/${threshold}` : '🏳 End?'}
      </button>

      {/* Portal popup — escapes overflow-hidden and transform stacking contexts */}
      {mounted && createPortal(
        <AnimatePresence>
          {showConfirm && (
            <>
              {/* Invisible backdrop to catch outside clicks */}
              <div
                className="fixed inset-0 z-[90]"
                onClick={() => setShowConfirm(false)}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.92, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, y: -4 }}
                transition={{ type: 'spring', stiffness: 420, damping: 28 }}
                style={{ top: popupStyle.top, right: popupStyle.right }}
                className="fixed z-[100] bg-slate-900 border border-slate-700/80 rounded-2xl p-4 shadow-2xl shadow-black/60 w-56"
              >
                {/* Red accent line */}
                <div className="absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-red-500/60 to-transparent rounded-t-2xl" />

                <div className="flex items-start gap-2.5 mb-3">
                  <span className="text-lg mt-0.5">🏳️</span>
                  <div>
                    <p className="text-sm text-slate-100 font-bold leading-tight">End this game?</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Needs {threshold} of {totalPlayers} votes
                    </p>
                  </div>
                </div>

                {/* Vote progress bar */}
                {yesCount > 0 && (
                  <div className="mb-3">
                    <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                      <span>Current votes</span>
                      <span className="text-amber-400 font-semibold">{yesCount}/{threshold}</span>
                    </div>
                    <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-red-600 to-red-400 rounded-full transition-all"
                        style={{ width: `${Math.min(100, (yesCount / threshold) * 100)}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      socketEmit.voteEnd(roomId);
                      setShowConfirm(false);
                    }}
                    className="flex-1 text-xs py-2 bg-red-700 hover:bg-red-600 active:bg-red-800 text-white rounded-xl font-bold transition-colors"
                  >
                    Yes, End
                  </button>
                  <button
                    onClick={() => setShowConfirm(false)}
                    className="flex-1 text-xs py-2 bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-slate-300 rounded-xl font-medium transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}
