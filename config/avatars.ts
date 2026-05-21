export interface PresetAvatar {
  id: string;
  emoji: string;
  label: string;
  bg: string;
}

export const PRESET_AVATARS: PresetAvatar[] = [
  { id: 'spade',   emoji: '♠️', label: 'Spade',   bg: 'from-slate-700 to-slate-900' },
  { id: 'lion',    emoji: '🦁', label: 'Lion',    bg: 'from-yellow-700 to-yellow-900' },
  { id: 'wolf',    emoji: '🐺', label: 'Wolf',    bg: 'from-blue-800 to-slate-900' },
  { id: 'fox',     emoji: '🦊', label: 'Fox',     bg: 'from-orange-700 to-red-900' },
  { id: 'dragon',  emoji: '🐉', label: 'Dragon',  bg: 'from-red-700 to-purple-900' },
  { id: 'owl',     emoji: '🦉', label: 'Owl',     bg: 'from-amber-700 to-stone-900' },
  { id: 'shark',   emoji: '🦈', label: 'Shark',   bg: 'from-cyan-700 to-blue-900' },
  { id: 'panther', emoji: '🐆', label: 'Panther', bg: 'from-violet-800 to-slate-900' },
  { id: 'eagle',   emoji: '🦅', label: 'Eagle',   bg: 'from-sky-700 to-indigo-900' },
  { id: 'bear',    emoji: '🐻', label: 'Bear',    bg: 'from-stone-700 to-stone-900' },
  { id: 'phoenix', emoji: '🔥', label: 'Phoenix', bg: 'from-orange-600 to-red-800' },
  { id: 'ghost',   emoji: '👻', label: 'Ghost',   bg: 'from-slate-600 to-slate-800' },
];

export function getPresetAvatar(id: string): PresetAvatar {
  return PRESET_AVATARS.find(a => a.id === id) ?? PRESET_AVATARS[0];
}
