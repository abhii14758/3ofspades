'use client';
import { create } from 'zustand';
import type { Room, Player } from '@/types';

interface LobbyStore {
  currentRoom: Room | null;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  setRoom: (room: Room) => void;
  updateRoom: (room: Room) => void;
  setConnected: (connected: boolean) => void;
  setConnecting: (connecting: boolean) => void;
  setError: (error: string | null) => void;
  clearRoom: () => void;
  // derived helpers
  getLocalPlayer: (playerId: string) => Player | undefined;
  isHost: (playerId: string) => boolean;
  allPlayersReady: () => boolean;
}

export const useLobbyStore = create<LobbyStore>()((set, get) => ({
  currentRoom: null,
  isConnected: false,
  isConnecting: false,
  error: null,

  setRoom: (room) => set({ currentRoom: room, error: null }),

  updateRoom: (room) => set({ currentRoom: room }),

  setConnected: (connected) => set({ isConnected: connected }),

  setConnecting: (connecting) => set({ isConnecting: connecting }),

  setError: (error) => set({ error }),

  clearRoom: () => set({ currentRoom: null }),

  getLocalPlayer: (playerId) =>
    get().currentRoom?.players.find((p) => p.id === playerId),

  isHost: (playerId) => get().currentRoom?.hostId === playerId,

  /**
   * Returns true only when every human player has status === 'ready'.
   * Bot players are considered auto-ready and are excluded from the check.
   */
  allPlayersReady: () => {
    const room = get().currentRoom;
    if (!room || room.players.length === 0) return false;
    const humanPlayers = room.players.filter((p) => p.type === 'human');
    if (humanPlayers.length === 0) return false;
    return humanPlayers.every((p) => p.status === 'ready');
  },
}));
