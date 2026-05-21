export interface CardBack {
  id: string;
  label: string;
  gradient: string;
  pattern: string;
}

export const CARD_BACKS: CardBack[] = [
  { id: 'default',  label: 'Classic',   gradient: 'from-red-800 to-red-950',       pattern: '♠' },
  { id: 'midnight', label: 'Midnight',  gradient: 'from-indigo-800 to-slate-950',   pattern: '🌙' },
  { id: 'royal',    label: 'Royal',     gradient: 'from-purple-800 to-purple-950',  pattern: '♛' },
  { id: 'neon',     label: 'Neon',      gradient: 'from-green-500 to-emerald-900',  pattern: '⚡' },
  { id: 'galaxy',   label: 'Galaxy',    gradient: 'from-violet-600 to-indigo-950',  pattern: '🌌' },
  { id: 'gold',     label: 'Gold Rush', gradient: 'from-yellow-600 to-amber-900',   pattern: '✦' },
  { id: 'frost',    label: 'Frost',     gradient: 'from-cyan-400 to-blue-900',      pattern: '❄' },
  { id: 'shadow',   label: 'Shadow',    gradient: 'from-gray-700 to-gray-950',      pattern: '♟' },
  { id: 'cherry',   label: 'Cherry',    gradient: 'from-pink-600 to-rose-950',      pattern: '♥' },
  { id: 'forest',   label: 'Forest',    gradient: 'from-green-800 to-green-950',    pattern: '♣' },
  { id: 'ocean',    label: 'Ocean',     gradient: 'from-blue-500 to-blue-950',      pattern: '♦' },
  { id: 'ember',    label: 'Ember',     gradient: 'from-orange-600 to-red-950',     pattern: '🔥' },
];

export function getCardBack(id: string): CardBack {
  return CARD_BACKS.find(cb => cb.id === id) ?? CARD_BACKS[0];
}
