'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface PlayerStore {
  userId: string | null;
  playerId: string | null;
  playerName: string;
  roomId: string | null;
  presetAvatarId: string;
  avatarType: 'preset' | 'upload';
  avatarUrl: string;
  equippedFrameId: string;
  setUserId: (id: string) => void;
  setPlayerId: (id: string) => void;
  setPlayerName: (name: string) => void;
  setRoomId: (id: string | null) => void;
  setAvatar: (data: { presetAvatarId?: string; avatarType?: 'preset' | 'upload'; avatarUrl?: string; equippedFrameId?: string }) => void;
  clear: () => void;
}

export const usePlayerStore = create<PlayerStore>()(
  persist(
    (set) => ({
      userId: null,
      playerId: null,
      playerName: '',
      roomId: null,
      presetAvatarId: 'spade',
      avatarType: 'preset',
      avatarUrl: '',
      equippedFrameId: 'none',
      setUserId: (id) => set({ userId: id }),
      setPlayerId: (id) => set({ playerId: id }),
      setPlayerName: (name) => set({ playerName: name }),
      setRoomId: (id) => set({ roomId: id }),
      setAvatar: (data) => set(data),
      clear: () => set({ userId: null, playerId: null, playerName: '', roomId: null }),
    }),
    { name: 'kali-teeri-player' }
  )
);
