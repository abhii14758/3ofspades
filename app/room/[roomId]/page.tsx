'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { useLobbyStore } from '@/store/lobbyStore';
import { usePlayerStore } from '@/store/playerStore';
import { useGameStore } from '@/store/gameStore';
import { socketEmit, connectSocket, getSocket } from '@/lib/socket/socketClient';
import type { Player } from '@/types';

// ─── Clipboard helper (works on HTTP/LAN, not just HTTPS) ─────────────────────
async function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }
  // Fallback for http:// LAN access where Clipboard API is unavailable
  const el = document.createElement('textarea');
  el.value = text;
  el.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none;';
  document.body.appendChild(el);
  el.focus();
  el.select();
  const ok = document.execCommand('copy');
  document.body.removeChild(el);
  if (!ok) throw new Error('execCommand copy failed');
}

// ─── Avatar component ─────────────────────────────────────────────────────────

function PlayerAvatar({ player, isLocal }: { player: Player; isLocal: boolean }) {
  const isBot = player.type === 'bot';
  return (
    <div
      className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 shadow-lg ${
        isLocal
          ? 'bg-indigo-600 text-white ring-2 ring-indigo-400 ring-offset-2 ring-offset-slate-900'
          : isBot
            ? 'bg-violet-800 text-violet-100'
            : player.isHost
              ? 'bg-amber-700 text-amber-100'
              : 'bg-slate-700 text-slate-200'
      }`}
    >
      {isBot ? '🤖' : player.name.charAt(0).toUpperCase()}
    </div>
  );
}

// ─── Config pill ──────────────────────────────────────────────────────────────

function ConfigPill({ icon, label }: { icon: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs bg-amber-900/20 border border-amber-700/40 text-amber-300 px-2.5 py-1.5 rounded-full font-medium">
      <span>{icon}</span>
      {label}
    </span>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const router = useRouter();

  const { currentRoom, isConnected, allPlayersReady, clearRoom } = useLobbyStore();
  const { playerId } = usePlayerStore();
  const { gameState } = useGameStore();
  const [copied, setCopied] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [joinName, setJoinName] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  const shareLink = typeof window !== 'undefined'
    ? `${window.location.origin}/room/${roomId}`
    : `/room/${roomId}`;

  useEffect(() => {
    connectSocket();
  }, []);

  // Listen for host-terminated event
  useEffect(() => {
    const socket = getSocket();
    const onTerminated = () => {
      toast.error('Game was terminated by host');
      clearRoom();
      router.push('/');
    };
    const onKicked = ({ reason }: { reason: string }) => {
      toast.error(reason ?? 'You were removed from the room');
      clearRoom();
      router.push('/');
    };
    const onRoomClosed = ({ reason }: { reason: string }) => {
      toast.error(reason ?? 'Room was closed');
      clearRoom();
      router.push('/');
    };
    socket.on('game:terminated', onTerminated);
    socket.on('room:kicked', onKicked);
    socket.on('room:closed', onRoomClosed);
    return () => {
      socket.off('game:terminated', onTerminated);
      socket.off('room:kicked', onKicked);
      socket.off('room:closed', onRoomClosed);
    };
  }, [clearRoom, router]);

  const room = currentRoom;
  const isHost = room?.hostId === playerId;
  const myPlayer = room?.players.find((p) => p.id === playerId);
  const isReady = myPlayer?.status === 'ready' || myPlayer?.type === 'bot';
  const readyCount = room?.players.filter(
    (p) => p.status === 'ready' || p.type === 'bot',
  ).length ?? 0;
  const canStart =
    isHost &&
    !!room &&
    room.players.length === room.maxPlayers &&
    allPlayersReady();
  const canAddBot = isHost && !!room && room.players.length < room.maxPlayers;

  const gamePhase = gameState?.phase;
  const showNextRound = isHost && gamePhase === 'round_end';
  const showTerminate =
    isHost && !!gamePhase && gamePhase !== 'lobby' && gamePhase !== 'game_end';

  const copyCode = async () => {
    try {
      await copyToClipboard(roomId);
      setCopied(true);
      toast.success('Room code copied!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  const copyLink = async () => {
    try {
      await copyToClipboard(shareLink);
      setCopiedLink(true);
      toast.success('Link copied!');
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      toast.error('Failed to copy link');
    }
  };

  const handleReady = () => socketEmit.setReady(roomId);
  const handleAddBot = () => socketEmit.addBot(roomId);
  const handleStart = () => socketEmit.startGame(roomId);
  const handleLeave = () => { clearRoom(); router.push('/'); };
  const handleTerminate = () => socketEmit.terminateGame(roomId);
  const handleNextRound = () => socketEmit.startNextRound(roomId);

  // ─── Loading state ──────────────────────────────────────────────────────────
  if (!room) {
    const handleJoinViaLink = () => {
      if (!joinName.trim()) return;
      setIsJoining(true);
      usePlayerStore.getState().setPlayerName(joinName.trim());
      socketEmit.joinRoom({ roomId, playerName: joinName.trim() });
    };

    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
        <div className="text-center max-w-xs w-full">
          <motion.div
            animate={{ scale: [1, 1.15, 1] }}
            transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
            className="text-5xl mb-4"
          >
            ♠
          </motion.div>
          {isConnected ? (
            <>
              <p className="text-slate-200 font-semibold mb-1">Join Room</p>
              <p className="text-slate-500 text-sm mb-5">
                Enter your name to join <span className="font-mono text-slate-300">{roomId}</span>
              </p>
              <input
                type="text"
                placeholder="Your name"
                value={joinName}
                onChange={(e) => setJoinName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleJoinViaLink()}
                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-sm mb-3 outline-none focus:border-indigo-500"
                autoFocus
                maxLength={20}
              />
              <button
                onClick={handleJoinViaLink}
                disabled={!joinName.trim() || isJoining}
                className="w-full py-2.5 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isJoining ? 'Joining…' : 'Join Game →'}
              </button>
            </>
          ) : (
            <p className="text-sm font-medium text-slate-400">Connecting to server…</p>
          )}
          {!isConnected && (
            <p className="text-xs text-yellow-500 mt-2">Reconnecting to server…</p>
          )}
          <button
            onClick={() => router.push('/')}
            className="mt-6 text-xs text-slate-600 hover:text-slate-400 underline transition-colors"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  // ─── Room page ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-950 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-indigo-900/20 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 max-w-lg mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={handleLeave}
            className="text-slate-500 hover:text-slate-300 text-sm transition-colors flex items-center gap-1"
          >
            ← Leave
          </button>
          <h1 className="text-lg font-black text-white truncate max-w-[200px]" title={room.name}>
            {room.name}
          </h1>
          <span
            className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${
              isConnected
                ? 'bg-green-900/40 border-green-700/50 text-green-400 shadow-[0_0_8px_rgba(74,222,128,0.2)]'
                : 'bg-yellow-900/40 border-yellow-700/50 text-yellow-400'
            }`}
          >
            {isConnected ? '● Live' : '⏳ …'}
          </span>
        </div>

        {/* Room code card */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 280, damping: 26 }}
          className="relative mb-5 rounded-2xl overflow-hidden"
        >
          <div className="bg-slate-900/95 border border-amber-600/40 backdrop-blur rounded-2xl p-5 text-center shadow-2xl">
            <p className="text-slate-500 text-[10px] uppercase tracking-[0.2em] mb-3">
              Room Code
            </p>
            <div className="font-black text-amber-300 tracking-[0.3em] font-mono text-4xl sm:text-5xl mb-3 select-all">
              {roomId}
            </div>
            <button
              onClick={copyCode}
              className={`inline-flex items-center gap-2 text-sm font-semibold px-5 py-2 rounded-xl transition-all ${
                copied
                  ? 'bg-green-700/60 text-green-300 border border-green-600/50'
                  : 'bg-amber-900/30 hover:bg-amber-900/50 text-amber-300 border border-amber-700/50'
              }`}
            >
              {copied ? '✓ Copied!' : '📋 Copy Code'}
            </button>
            <p className="text-slate-600 text-[11px] mt-3">
              Share this link for others to join directly
            </p>
          </div>
          {/* Pulsing border ring */}
          <motion.div
            animate={{ opacity: [0.3, 0.7, 0.3] }}
            transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
            className="absolute inset-0 rounded-2xl border-2 border-amber-500/50 pointer-events-none"
          />
        </motion.div>

        {/* Share link card */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, type: 'spring', stiffness: 260, damping: 26 }}
          className="mb-5 bg-slate-900/80 border border-slate-700/50 rounded-2xl p-4"
        >
          <p className="text-slate-500 text-[10px] uppercase tracking-[0.18em] mb-2 text-center">
            🔗 Share Link
          </p>
          <div className="flex items-center gap-2 bg-slate-800/70 border border-slate-700/60 rounded-xl px-3 py-2 mb-2">
            <span className="text-slate-300 text-xs font-mono flex-1 truncate select-all" title={shareLink}>
              {shareLink}
            </span>
            <button
              onClick={copyLink}
              className={`shrink-0 text-xs font-semibold px-3 py-1 rounded-lg transition-all ${
                copiedLink
                  ? 'bg-green-700/60 text-green-300'
                  : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
              }`}
            >
              {copiedLink ? '✓' : 'Copy'}
            </button>
          </div>
          <p className="text-slate-600 text-[10px] text-center">
            Share this link for others to join directly
          </p>
        </motion.div>

        {/* Config pills (if config present on room) */}
        {'config' in room && room.config && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-wrap gap-2 mb-5 justify-center"
          >
            {(room as { config: { turnTimerSeconds?: number; targetScore?: number; maxRounds?: number; autoFillBots?: boolean } }).config.turnTimerSeconds !== undefined && (
              <ConfigPill
                icon="⏱"
                label={
                  (room as { config: { turnTimerSeconds: number } }).config.turnTimerSeconds === 0
                    ? 'No Timer'
                    : `${(room as { config: { turnTimerSeconds: number } }).config.turnTimerSeconds}s Turn`
                }
              />
            )}
            {(room as { config: { targetScore?: number } }).config.targetScore !== undefined && (
              <ConfigPill
                icon="🏆"
                label={`${(room as { config: { targetScore: number } }).config.targetScore} pts`}
              />
            )}
            {(room as { config: { maxRounds?: number } }).config.maxRounds !== undefined && (
              <ConfigPill
                icon="🔄"
                label={
                  (room as { config: { maxRounds: number } }).config.maxRounds === 0
                    ? 'Unlimited Rounds'
                    : `${(room as { config: { maxRounds: number } }).config.maxRounds} Rounds`
                }
              />
            )}
            {(room as { config: { autoFillBots?: boolean } }).config.autoFillBots && (
              <ConfigPill icon="🤖" label="Auto Bots" />
            )}
          </motion.div>
        )}

        {/* Player list */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, type: 'spring', stiffness: 260, damping: 24 }}
          className="bg-slate-900/95 border border-slate-700/60 rounded-2xl shadow-xl overflow-hidden mb-5"
        >
          {/* List header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/50 bg-slate-800/40">
            <div>
              <h3 className="text-slate-100 font-bold text-sm">Players</h3>
              <p className="text-slate-500 text-xs mt-0.5">
                {room.players.length}/{room.maxPlayers} joined · {readyCount} ready
              </p>
            </div>
            <div className="flex gap-1.5">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className={`w-2 h-2 rounded-full transition-colors duration-300 ${
                    i < room.players.length ? 'bg-green-500' : 'bg-slate-700'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Players */}
          <div className="divide-y divide-slate-700/30">
            <AnimatePresence initial={false}>
              {room.players.map((player) => {
                const isLocal = player.id === playerId;
                const isBot = player.type === 'bot';
                const ready = player.status === 'ready' || isBot;

                return (
                  <motion.div
                    key={player.id}
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 16 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                    className={`flex items-center gap-3 px-5 py-3.5 transition-colors ${
                      isLocal ? 'bg-indigo-900/20' : 'hover:bg-slate-800/30'
                    }`}
                  >
                    <PlayerAvatar player={player} isLocal={isLocal} />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`font-semibold text-sm truncate ${
                            isLocal ? 'text-indigo-200' : 'text-slate-200'
                          }`}
                        >
                          {player.name}
                        </span>
                        {isLocal && (
                          <span className="text-[10px] bg-indigo-700/60 text-indigo-300 px-1.5 py-0.5 rounded font-medium">
                            You
                          </span>
                        )}
                        {player.isHost && (
                          <span className="text-[10px] bg-amber-800/40 text-amber-400 px-1.5 py-0.5 rounded font-medium">
                            👑 Host
                          </span>
                        )}
                        {isBot && (
                          <span className="text-[10px] bg-violet-800/50 text-violet-300 px-1.5 py-0.5 rounded font-medium">
                            BOT
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">Seat {player.seatIndex + 1}</p>
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      {/* Kick button — only host sees it, not for self, only in lobby */}
                      {isHost && !isLocal && !gameState && (
                        <button
                          onClick={() => socketEmit.kickPlayer(roomId, player.id)}
                          className="w-7 h-7 rounded-full flex items-center justify-center bg-red-900/30 hover:bg-red-800/60 border border-red-700/40 hover:border-red-600/60 text-red-400 hover:text-red-300 transition-all text-xs"
                          title={`Remove ${player.name}`}
                        >
                          ✕
                        </button>
                      )}
                      {ready ? (
                        <span className="inline-flex items-center gap-1 text-xs bg-green-900/40 text-emerald-400 border border-emerald-700/40 px-2.5 py-1 rounded-full font-medium">
                          ✓ Ready
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs bg-slate-800/60 text-slate-500 border border-slate-700/40 px-2.5 py-1 rounded-full font-medium">
                          Waiting…
                        </span>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {/* Empty slots */}
            {Array.from({ length: Math.max(0, 6 - room.players.length) }).map((_, i) => (
              <motion.div
                key={`empty-${i}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-3 px-5 py-3.5 opacity-25"
              >
                <div className="w-10 h-10 rounded-full border-2 border-dashed border-slate-600 flex items-center justify-center shrink-0">
                  <span className="text-slate-600 text-xs">?</span>
                </div>
                <span className="text-slate-600 text-sm italic">Empty seat…</span>
              </motion.div>
            ))}
          </div>

          {/* Ready toggle */}
          {myPlayer?.type !== 'bot' && (
            <div className="px-5 py-4 border-t border-slate-700/50 bg-slate-800/30">
              <button
                onClick={handleReady}
                className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  isReady
                    ? 'bg-emerald-900/40 text-emerald-300 border border-emerald-600/50 hover:bg-emerald-800/50'
                    : 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-lg shadow-indigo-500/20'
                }`}
              >
                {isReady ? '✓ Ready — Click to Unready' : 'Mark as Ready'}
              </button>
            </div>
          )}
        </motion.div>

        {/* Waiting message */}
        {room.players.length < room.maxPlayers && (
          <p className="text-center text-slate-600 text-sm mb-4">
            Waiting for players… ({room.players.length}/{room.maxPlayers})
          </p>
        )}

        {/* Action buttons */}
        <div className="flex flex-col gap-3">
          {/* Add Bot */}
          {canAddBot && (
            <button
              onClick={handleAddBot}
              className="w-full py-2.5 rounded-xl text-sm font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-600 transition-all"
            >
              🤖 Add Bot ({room.maxPlayers - room.players.length} slot{room.maxPlayers - room.players.length !== 1 ? 's' : ''} open)
            </button>
          )}

          {/* Start Next Round */}
          {showNextRound && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 24 }}
            >
              <button
                onClick={handleNextRound}
                className="w-full py-3.5 rounded-xl text-base font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-500/20 transition-all"
              >
                ▶ Start Next Round
              </button>
            </motion.div>
          )}

          {/* Start Game */}
          {isHost && !showNextRound && (
            <button
              className={`w-full py-3.5 rounded-xl text-sm font-bold transition-all ${
                canStart
                  ? 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white shadow-lg shadow-green-900/40'
                  : 'bg-slate-800 text-slate-500 border border-slate-700 opacity-60 cursor-not-allowed'
              }`}
              disabled={!canStart}
              onClick={handleStart}
            >
              {canStart
                ? '🃏 Start Game'
                : room.players.length < room.maxPlayers
                  ? `Need ${room.maxPlayers - room.players.length} more player${room.maxPlayers - room.players.length !== 1 ? 's' : ''}`
                  : `Waiting for all to ready up (${readyCount}/${room.players.length})`}
            </button>
          )}

          {/* Terminate Game */}
          {showTerminate && (
            <button
              onClick={handleTerminate}
              className="w-full py-2.5 rounded-xl text-sm font-semibold bg-red-900/60 hover:bg-red-800 text-red-300 border border-red-700 transition-all"
            >
              ✕ Terminate Game
            </button>
          )}

          {/* Non-host waiting message */}
          {!isHost && isReady && room.players.length === room.maxPlayers && allPlayersReady() && (
            <p className="text-center text-slate-500 text-xs py-1">
              All ready! Waiting for host to start…
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
