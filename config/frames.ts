export interface Frame {
  id: string;
  label: string;
  ringColor: string;
  glowColor: string;
  overlayEmoji?: string;
  overlayBg?: string;
  gradient?: string;
}

export const FRAMES: Frame[] = [
  { id: 'none',    label: 'No Frame',     ringColor: '#d4af37', glowColor: 'rgba(212,175,55,0.2)' },
  { id: 'gold',    label: 'Gold',         ringColor: '#f5c518', glowColor: 'rgba(245,197,24,0.6)',  gradient: 'linear-gradient(135deg, #f5c518, #c8942a, #f5c518)', overlayEmoji: '⭐', overlayBg: '#1a1a1a' },
  { id: 'silver',  label: 'Silver',       ringColor: '#c0c0c0', glowColor: 'rgba(192,192,192,0.5)', gradient: 'linear-gradient(135deg, #e8e8e8, #a0a0a0, #e8e8e8)', overlayEmoji: '💫', overlayBg: '#1a1a1a' },
  { id: 'fire',    label: 'Fire',         ringColor: '#ff4500', glowColor: 'rgba(255,69,0,0.6)',    gradient: 'linear-gradient(135deg, #ff4500, #ff8c00, #ff4500)', overlayEmoji: '🔥', overlayBg: '#1a1a1a' },
  { id: 'ice',     label: 'Ice',          ringColor: '#00bfff', glowColor: 'rgba(0,191,255,0.5)',   gradient: 'linear-gradient(135deg, #00bfff, #7fffd4, #00bfff)', overlayEmoji: '❄️', overlayBg: '#1a1a1a' },
  { id: 'rainbow', label: 'Rainbow',      ringColor: '#ff0080', glowColor: 'rgba(255,0,128,0.4)',   gradient: 'linear-gradient(135deg, #ff0080, #ff8c00, #40e0d0, #ff0080)', overlayEmoji: '🌈', overlayBg: '#1a1a1a' },
  { id: 'diamond', label: 'Diamond',      ringColor: '#b9f2ff', glowColor: 'rgba(185,242,255,0.6)', gradient: 'linear-gradient(135deg, #b9f2ff, #fff, #b9f2ff)', overlayEmoji: '💎', overlayBg: '#1a1a1a' },
  { id: 'spade',   label: 'Spade Master', ringColor: '#6366f1', glowColor: 'rgba(99,102,241,0.5)',  gradient: 'linear-gradient(135deg, #4f46e5, #818cf8, #4f46e5)', overlayEmoji: '♠️', overlayBg: '#1a1a1a' },
  { id: 'crown',   label: 'Crown',        ringColor: '#ffd700', glowColor: 'rgba(255,215,0,0.7)',   gradient: 'linear-gradient(135deg, #ffd700, #ff8c00, #ffd700)', overlayEmoji: '👑', overlayBg: '#1a1a1a' },
  { id: 'venom',   label: 'Venom',        ringColor: '#00ff00', glowColor: 'rgba(0,255,0,0.4)',     gradient: 'linear-gradient(135deg, #00ff00, #008000, #00ff00)', overlayEmoji: '☠️', overlayBg: '#1a1a1a' },
  { id: 'galaxy',  label: 'Galaxy',       ringColor: '#9b59b6', glowColor: 'rgba(155,89,182,0.6)', gradient: 'linear-gradient(135deg, #9b59b6, #2c3e50, #8e44ad)', overlayEmoji: '🌌', overlayBg: '#1a1a1a' },
  { id: 'cherry',  label: 'Cherry',       ringColor: '#ff6b9d', glowColor: 'rgba(255,107,157,0.5)', gradient: 'linear-gradient(135deg, #ff6b9d, #c44569, #ff6b9d)', overlayEmoji: '🌸', overlayBg: '#1a1a1a' },
];

export function getFrame(id: string): Frame {
  return FRAMES.find(f => f.id === id) ?? FRAMES[0];
}
