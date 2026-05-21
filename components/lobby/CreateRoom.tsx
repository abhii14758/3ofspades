'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Button from '@/components/ui/Button';
import type { GamePreset, RoomConfig } from '@/types';
import { GAME_PRESETS } from '@/config/gameConfig';

interface CreateRoomProps {
  onSubmit: (roomName: string, config: RoomConfig) => void;
  isLoading?: boolean;
}

interface PillOption<T> {
  label: string;
  sublabel?: string;
  value: T;
}

function PillSelector<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: PillOption<T>[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-1 p-1 bg-slate-800/80 rounded-xl border border-slate-700/50">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={String(opt.value)}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`relative flex-1 py-2 px-2 rounded-lg text-xs font-semibold transition-all duration-150 ${
              active
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
            }`}
          >
            <span className="block leading-tight">{opt.label}</span>
            {opt.sublabel && (
              <span className={`block text-[10px] mt-0.5 ${active ? 'text-indigo-300' : 'text-slate-600'}`}>
                {opt.sublabel}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none ${
        checked ? 'bg-indigo-600' : 'bg-slate-700'
      }`}
    >
      <motion.span
        layout
        transition={{ type: 'spring', stiffness: 500, damping: 35 }}
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

// ─── Preset definitions ───────────────────────────────────────────────────────

interface PresetMeta {
  id: GamePreset;
  title: string;
  players: string;
  decks: string;
  cardsEach: number;
  minBid: number;
  tricks: number;
  partners: number;
  icon: string;
  accent: string;
}

const PRESET_META: PresetMeta[] = [
  {
    id: '4p1d',
    title: '4 Players',
    players: '4 Players',
    decks: 'One Deck',
    cardsEach: 12,
    minBid: 150,
    tricks: 12,
    partners: 1,
    icon: '♠',
    accent: 'from-blue-600 to-cyan-600',
  },
  {
    id: '6p1d',
    title: '6 Players',
    players: '6 Players',
    decks: 'One Deck',
    cardsEach: 8,
    minBid: 130,
    tricks: 8,
    partners: 2,
    icon: '♣',
    accent: 'from-indigo-600 to-violet-600',
  },
  {
    id: '6p2d',
    title: '6 Players',
    players: '6 Players',
    decks: 'Two Decks',
    cardsEach: 16,
    minBid: 260,
    tricks: 16,
    partners: 2,
    icon: '♥',
    accent: 'from-rose-600 to-pink-600',
  },
  {
    id: '8p2d',
    title: '8 Players',
    players: '8 Players',
    decks: 'Two Decks',
    cardsEach: 12,
    minBid: 200,
    tricks: 12,
    partners: 3,
    icon: '♦',
    accent: 'from-amber-600 to-orange-600',
  },
  {
    id: '10p2d',
    title: '10 Players',
    players: '10 Players',
    decks: 'Two Decks',
    cardsEach: 9,
    minBid: 250,
    tricks: 9,
    partners: 4,
    icon: '★',
    accent: 'from-emerald-600 to-teal-600',
  },
];

// ─── Pill options ─────────────────────────────────────────────────────────────

const timerOptions: PillOption<number>[] = [
  { label: 'No Limit', value: 0 },
  { label: '30s', value: 30 },
  { label: '60s', sublabel: 'default', value: 60 },
  { label: '90s', value: 90 },
];

const roundOptions: PillOption<number>[] = [
  { label: 'Unlimited', value: 0 },
  { label: '3 Rounds', value: 3 },
  { label: '5 Rounds', value: 5 },
];

const containerVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 280, damping: 26, staggerChildren: 0.06 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 320, damping: 28 } },
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function CreateRoom({ onSubmit, isLoading = false }: CreateRoomProps) {
  const [roomName, setRoomName] = useState('');
  const [errors, setErrors] = useState<{ roomName?: string }>({});

  const [preset, setPreset] = useState<GamePreset>('6p1d');
  const [turnTimerSeconds, setTurnTimerSeconds] = useState<number>(60);
  const [maxRounds, setMaxRounds] = useState<number>(0);
  const [autoFillBots, setAutoFillBots] = useState(false);

  const selectedPresetCfg = GAME_PRESETS[preset];
  const targetScore = selectedPresetCfg.totalRoundPoints * 2;

  const validate = () => {
    const e: typeof errors = {};
    if (!roomName.trim()) e.roomName = 'Room name is required';
    else if (roomName.trim().length < 2) e.roomName = 'At least 2 characters';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      onSubmit(roomName.trim(), {
        preset,
        turnTimerSeconds,
        targetScore,
        maxRounds,
        autoFillBots,
      });
    }
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="bg-slate-900/95 border border-slate-700/60 backdrop-blur rounded-2xl shadow-2xl p-5 w-full"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="mb-5 text-center">
        <div className="text-4xl mb-2">🃏</div>
        <h2 className="text-2xl font-black text-slate-100">Create Room</h2>
        <p className="text-slate-400 text-sm mt-1">Set up your game and invite friends</p>
      </motion.div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Room Name */}
        <motion.div variants={itemVariants}>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Room Name</label>
          <input
            type="text"
            value={roomName}
            onChange={(e) => {
              setRoomName(e.target.value);
              setErrors((prev) => ({ ...prev, roomName: undefined }));
            }}
            placeholder="e.g. Friday Night Games"
            maxLength={30}
            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
          />
          <AnimatePresence>
            {errors.roomName && (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-1 text-xs text-red-400"
              >
                {errors.roomName}
              </motion.p>
            )}
          </AnimatePresence>
        </motion.div>

        {/* ── Game Mode ── */}
        <motion.div variants={itemVariants} className="border-t border-slate-700/50 pt-4">
          <p className="text-xs text-slate-500 uppercase tracking-widest mb-3">🎮 Game Mode</p>
          <div className="grid grid-cols-2 gap-2">
            {PRESET_META.map((pm) => {
              const active = preset === pm.id;
              return (
                <button
                  key={pm.id}
                  type="button"
                  onClick={() => setPreset(pm.id)}
                  className={`relative overflow-hidden rounded-xl p-3 text-left transition-all duration-200 border-2 ${
                    active
                      ? 'border-indigo-500 bg-slate-800 shadow-lg shadow-indigo-500/20'
                      : 'border-slate-700/50 bg-slate-800/50 hover:border-slate-600 hover:bg-slate-800'
                  }`}
                >
                  {/* Gradient accent strip */}
                  {active && (
                    <span
                      className={`absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r ${pm.accent}`}
                    />
                  )}
                  <div className="flex items-start gap-2">
                    <span
                      className={`text-xl font-black leading-none bg-gradient-to-br ${pm.accent} bg-clip-text text-transparent`}
                    >
                      {pm.icon}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-100 leading-tight truncate">
                        {pm.players}
                      </p>
                      <p className={`text-xs mt-0.5 ${active ? 'text-indigo-300' : 'text-slate-500'}`}>
                        {pm.decks}
                      </p>
                    </div>
                    {active && (
                      <svg className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                      </svg>
                    )}
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-1">
                    <Stat label="Cards" value={pm.cardsEach} />
                    <Stat label="Min Bid" value={pm.minBid} />
                    <Stat label="Partners" value={pm.partners} />
                  </div>
                </button>
              );
            })}
          </div>
          {/* Preset summary */}
          <motion.div
            key={preset}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-2 px-3 py-2 bg-slate-800/40 rounded-lg border border-slate-700/30 text-xs text-slate-400 flex gap-4 flex-wrap"
          >
            <span>👥 {selectedPresetCfg.playerCount} players</span>
            <span>🃏 {selectedPresetCfg.cardsPerPlayer} cards each</span>
            <span>🔢 {selectedPresetCfg.totalTricks} tricks</span>
            <span>📈 Min bid: {selectedPresetCfg.minBid}</span>
            <span>🏆 {selectedPresetCfg.totalRoundPoints} pts/round</span>
          </motion.div>
        </motion.div>

        {/* Game Settings */}
        <motion.div variants={itemVariants} className="space-y-4">
          <p className="text-xs text-slate-500 uppercase tracking-widest">⚙️ Settings</p>

          {/* Turn Timer */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">⏱ Turn Timer</label>
            <PillSelector options={timerOptions} value={turnTimerSeconds} onChange={setTurnTimerSeconds} />
          </div>

          {/* Max Rounds */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">🔄 Max Rounds</label>
            <PillSelector options={roundOptions} value={maxRounds} onChange={setMaxRounds} />
          </div>

          {/* Auto-fill Bots */}
          <div className="flex items-center justify-between py-3 px-4 bg-slate-800/60 rounded-xl border border-slate-700/50">
            <div className="flex-1 mr-4">
              <p className="text-sm font-medium text-slate-300">🤖 Auto-fill with Bots</p>
              <p className="text-xs text-slate-500 mt-0.5">Fill empty seats with bots on start</p>
            </div>
            <ToggleSwitch checked={autoFillBots} onChange={setAutoFillBots} />
          </div>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Button type="submit" size="lg" className="w-full" loading={isLoading} disabled={isLoading}>
            🎴 Create Room
          </Button>
        </motion.div>
      </form>
    </motion.div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <p className="text-[10px] text-slate-600 leading-tight">{label}</p>
      <p className="text-xs font-bold text-slate-300">{value}</p>
    </div>
  );
}
