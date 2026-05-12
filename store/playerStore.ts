'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface PlayerStore {
  playerId: string | null;
  playerName: string;
  roomId: string | null;
  setPlayerId: (id: string) => void;
  setPlayerName: (name: string) => void;
  setRoomId: (id: string | null) => void;
  clear: () => void;
}

export const usePlayerStore = create<PlayerStore>()(
  persist(
    (set) => ({
      playerId: null,
      playerName: '',
      roomId: null,
      setPlayerId: (id) => set({ playerId: id }),
      setPlayerName: (name) => set({ playerName: name }),
      setRoomId: (id) => set({ roomId: id }),
      clear: () => set({ playerId: null, playerName: '', roomId: null }),
    }),
    { name: 'kali-teeri-player' }
  )
);
