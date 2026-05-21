'use client';
import { useState } from 'react';
import { motion } from 'framer-motion';
import Button from '@/components/ui/Button';

interface JoinRoomProps {
  onSubmit: (roomId: string) => void;
  isLoading?: boolean;
}

export default function JoinRoom({ onSubmit, isLoading = false }: JoinRoomProps) {
  const [roomId, setRoomId] = useState('');
  const [errors, setErrors] = useState<{ roomId?: string }>({});

  const validate = () => {
    const e: typeof errors = {};
    if (!roomId.trim()) e.roomId = 'Room code is required';
    else if (roomId.trim().length < 4) e.roomId = 'Enter a valid room code';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) onSubmit(roomId.trim().toUpperCase());
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
