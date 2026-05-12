'use client';
import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import CreateRoom from '@/components/lobby/CreateRoom';
import type { RoomConfig } from '@/types';
import JoinRoom from '@/components/lobby/JoinRoom';
import { useLobbyStore } from '@/store/lobbyStore';
import { usePlayerStore } from '@/store/playerStore';
import { socketEmit } from '@/lib/socket/socketClient';

function LobbyContent() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') === 'join' ? 'join' : 'create';
  const [activeTab, setActiveTab] = useState<'create' | 'join'>(initialTab);
  const [isLoading, setIsLoading] = useState(false);

  const { isConnected, error, setError } = useLobbyStore();
  const { setPlayerName } = usePlayerStore();

  useEffect(() => {
    setError(null);
  }, [activeTab, setError]);

  const handleCreate = (roomName: string, playerName: string, config: RoomConfig) => {
    if (!isConnected) {
      setError('Not connected to server. Please wait…');
      return;
    }
    setIsLoading(true);
    setPlayerName(playerName);
    socketEmit.createRoom({ roomName, playerName, config });
    const t = setTimeout(() => setIsLoading(false), 8000);
    return () => clearTimeout(t);
  };

  const handleJoin = (roomId: string, playerName: string) => {
    if (!isConnected) {
      setError('Not connected to server. Please wait…');
      return;
    }
    setIsLoading(true);
    setPlayerName(playerName);
    socketEmit.joinRoom({ roomId, playerName });
    const t = setTimeout(() => setIsLoading(false), 8000);
    return () => clearTimeout(t);
  };

  return (
    <div className="min-h-screen bg-slate-950 relative overflow-hidden flex flex-col items-center justify-center px-4 py-8">
      {/* Subtle dot grid background */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle at 25px 25px, white 2px, transparent 0)',
          backgroundSize: '50px 50px',
        }}
      />
      {/* Accent glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-indigo-700/10 rounded-full blur-3xl pointer-events-none" />

      {/* Back link */}
      <div className="absolute top-5 left-5 z-10">
        <Link
          href="/"
          className="text-slate-500 hover:text-slate-300 text-sm flex items-center gap-1.5 transition-colors"
        >
          ← Home
        </Link>
      </div>

      {/* Connection indicator */}
      <div className="absolute top-5 right-5 z-10 flex items-center gap-2 text-xs text-slate-500">
        <span
          className={`w-2 h-2 rounded-full transition-colors ${
            isConnected ? 'bg-green-400' : 'bg-yellow-500 animate-pulse'
          }`}
        />
        {isConnected ? 'Connected' : 'Connecting…'}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md relative z-10"
      >
        {/* Heading */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black bg-gradient-to-br from-white via-slate-200 to-indigo-400 bg-clip-text text-transparent">
            Lobby
          </h1>
          <p className="text-slate-500 text-sm mt-1.5">
            ♠ 3 of Spades · Kali Teeri
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex bg-slate-800/80 rounded-xl p-1 mb-5 border border-slate-700/60">
          {(['create', 'join'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                activeTab === tab
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              {tab === 'create' ? '🎴 Create Room' : '🔑 Join Room'}
            </button>
          ))}
        </div>

        {/* Error banner */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 p-3 rounded-lg bg-red-900/30 border border-red-700 text-red-300 text-sm"
          >
            {error}
          </motion.div>
        )}

        {/* Form panel */}
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, x: activeTab === 'create' ? -12 : 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === 'create' ? (
            <CreateRoom onSubmit={handleCreate} isLoading={isLoading} />
          ) : (
            <JoinRoom onSubmit={handleJoin} isLoading={isLoading} />
          )}
        </motion.div>
      </motion.div>
    </div>
  );
}

export default function LobbyPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center">
          <div className="text-slate-400 text-sm">Loading…</div>
        </div>
      }
    >
      <LobbyContent />
    </Suspense>
  );
}
