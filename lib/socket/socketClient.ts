'use client';

import { io, Socket } from 'socket.io-client';
import type {
  JoinRoomPayload,
  PlaceBidPayload,
  SelectTrumpPayload,
  SelectPartnersPayload,
  PlayCardPayload,
  ReconnectPayload,
  RoomConfig,
} from '@/types';

// ─── Singleton socket instance ────────────────────────────────────────────────

let socket: Socket | null = null;

/**
 * Returns the singleton Socket.IO client, creating it on first call.
 * Connects to the current host on the default `/socket.io` path,
 * which the custom server.ts mounts automatically.
 * `autoConnect: false` so callers explicitly control when the connection opens.
 */
export function getSocket(): Socket {
  if (!socket) {
    socket = io({
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });
  }
  return socket;
}

/** Opens the socket connection (idempotent). Returns the socket. */
export function connectSocket(): Socket {
  const s = getSocket();
  if (!s.connected) s.connect();
  return s;
}

/** Gracefully closes the socket connection. */
export function disconnectSocket(): void {
  if (socket?.connected) socket.disconnect();
}

// ─── Typed emit helpers ───────────────────────────────────────────────────────

/**
 * One strongly-typed function per client→server event.
 * Callers should call `connectSocket()` before using any of these.
 */
export const socketEmit = {
  createRoom: (payload: { roomName: string; playerName: string; config?: Partial<RoomConfig> }) =>
    getSocket().emit('room:create', payload),

  joinRoom: (payload: JoinRoomPayload) =>
    getSocket().emit('room:join', payload),

  setReady: (roomId: string) =>
    getSocket().emit('room:ready', { roomId }),

  addBot: (roomId: string) =>
    getSocket().emit('room:addBot', { roomId }),

  startGame: (roomId: string) =>
    getSocket().emit('game:start', { roomId }),

  placeBid: (payload: PlaceBidPayload) =>
    getSocket().emit('game:placeBid', payload),

  selectTrump: (payload: SelectTrumpPayload) =>
    getSocket().emit('game:selectTrump', payload),

  selectPartners: (payload: SelectPartnersPayload) =>
    getSocket().emit('game:selectPartners', payload),

  playCard: (payload: PlayCardPayload) =>
    getSocket().emit('game:playCard', payload),

  reconnect: (payload: ReconnectPayload) =>
    getSocket().emit('player:reconnect', payload),

  terminateGame: (roomId: string) =>
    getSocket().emit('game:terminate', { roomId }),

  startNextRound: (roomId: string) =>
    getSocket().emit('game:nextRound', { roomId }),

  skipDeal: (roomId: string) =>
    getSocket().emit('game:skipDeal', { roomId }),
};
