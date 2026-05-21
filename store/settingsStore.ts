'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsStore {
  soundVolume: number;
  musicVolume: number;
  muted: boolean;
  language: string;
  setSoundVolume: (v: number) => void;
  setMusicVolume: (v: number) => void;
  setMuted: (m: boolean) => void;
  setLanguage: (l: string) => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      soundVolume: 70,
      musicVolume: 50,
      muted: false,
      language: 'en',
      setSoundVolume: (v) => set({ soundVolume: v }),
      setMusicVolume: (v) => set({ musicVolume: v }),
      setMuted: (m) => set({ muted: m }),
      setLanguage: (l) => set({ language: l }),
    }),
    { name: 'kali-teeri-settings' }
  )
);
