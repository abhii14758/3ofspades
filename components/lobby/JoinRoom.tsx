'use client';
import { useState } from 'react';
import { motion } from 'framer-motion';
import Button from '@/components/ui/Button';

interface JoinRoomProps {
  onSubmit: (roomId: string, playerName: string) => void;
  isLoading?: boolean;
}

export default function JoinRoom({ onSubmit, isLoading = false }: JoinRoomProps) {
  const [roomId, setRoomId] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [errors, setErrors] = useState<{ roomId?: string; playerName?: string }>({});

  const validate = () => {
    const e: typeof errors = {};
    if (!roomId.trim()) e.roomId = 'Room code is required';
    else if (roomId.trim().length < 4) e.roomId = 'Enter a valid room code';
    if (!playerName.trim()) e.playerName = 'Player name is required';
    else if (playerName.trim().length < 2) e.playerName = 'At least 2 characters';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) onSubmit(roomId.trim().toUpperCase(), playerName.trim());
  };

  const handleRoomIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    setRoomId(val);
    setErrors((prev) => ({ ...prev, roomId: undefined }));
  };

  return (
    <motion.div
      className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-8 w-full max-w-md"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 320, damping: 28 }}
    >
      <div className="mb-6 text-center">
        <div className="text-4xl mb-2">🚪</div>
        <h2 className="text-2xl font-black text-slate-100">Join Room</h2>
        <p className="text-slate-400 text-sm mt-1">Enter a room code to join a game</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            Room Code
          </label>
          <input
            type="text"
            value={roomId}
            onChange={handleRoomIdChange}
            placeholder="e.g. ABC123"
            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-colors font-mono text-lg tracking-widest uppercase"
          />
          {errors.roomId && (
            <p className="mt-1 text-xs text-red-400">{errors.roomId}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            Your Name
          </label>
          <input
            type="text"
            value={playerName}
            onChange={(e) => {
              setPlayerName(e.target.value);
              setErrors((prev) => ({ ...prev, playerName: undefined }));
            }}
            placeholder="e.g. Fatima"
            maxLength={20}
            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-colors"
          />
          {errors.playerName && (
            <p className="mt-1 text-xs text-red-400">{errors.playerName}</p>
          )}
        </div>

        <Button
          type="submit"
          size="lg"
          className="w-full mt-2"
          loading={isLoading}
          disabled={isLoading}
        >
          Join Room
        </Button>
      </form>
    </motion.div>
  );
}
