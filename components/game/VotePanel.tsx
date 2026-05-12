'use client';
import { useState } from 'react';
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
  const hasVoted = voteEndVotes[myPlayerId] === true;
  const yesCount = Object.values(voteEndVotes).filter(Boolean).length;
  const threshold = Math.ceil(totalPlayers * 0.8);

  return (
    <div className="relative">
      <button
        onClick={() => !hasVoted && setShowConfirm(true)}
        disabled={hasVoted}
        className={`text-xs px-2 py-1 rounded border transition-colors ${
          hasVoted
            ? 'bg-slate-800/60 border-slate-700/40 text-slate-500 cursor-default'
            : 'bg-red-950/60 hover:bg-red-900/70 border-red-800/60 text-red-300'
        }`}
        title={hasVoted ? `Voted (${yesCount}/${threshold} needed)` : 'Vote to end game'}
      >
        🏳️ {hasVoted ? `${yesCount}/${threshold}` : 'End?'}
      </button>

      <AnimatePresence>
        {showConfirm && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 8 }}
            className="absolute bottom-8 right-0 z-50 bg-slate-900 border border-red-700/60 rounded-xl p-3 shadow-2xl w-52"
          >
            <p className="text-xs text-slate-300 mb-2 font-medium">Vote to end this game?</p>
            <p className="text-[10px] text-slate-500 mb-3">
              Game ends if {threshold}/{totalPlayers} players vote yes.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  socketEmit.voteEnd(roomId);
                  setShowConfirm(false);
                }}
                className="flex-1 text-xs py-1.5 bg-red-700 hover:bg-red-600 text-white rounded-lg font-bold transition-colors"
              >
                Yes, End
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 text-xs py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
