'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface PlayerStore {
  userId: string | null;
  playerId: string | null;
  playerName: string;
  roomId: string | null;
  setUserId: (id: string) => void;
  setPlayerId: (id: string) => void;
  setPlayerName: (name: string) => void;
  setRoomId: (id: string | null) => void;
  clear: () => void;
}

export const usePlayerStore = create<PlayerStore>()(
  persist(
    (set) => ({
      userId: null,
      playerId: null,
      playerName: '',
      roomId: null,
      setUserId: (id) => set({ userId: id }),
      setPlayerId: (id) => set({ playerId: id }),
      setPlayerName: (name) => set({ playerName: name }),
      setRoomId: (id) => set({ roomId: id }),
      clear: () => set({ userId: null, playerId: null, playerName: '', roomId: null }),
    }),
    { name: 'kali-teeri-player' }
  )
);
