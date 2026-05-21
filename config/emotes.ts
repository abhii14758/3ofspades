export interface Emote {
  id: string;
  label: string;
  emoji: string;
}

export const ALL_EMOTES: Emote[] = [
  { id: 'gg',          label: 'GG',          emoji: '🤝' },
  { id: 'nice',        label: 'Nice Play',   emoji: '👏' },
  { id: 'oops',        label: 'Oops',        emoji: '😅' },
  { id: 'thinking',    label: 'Thinking',    emoji: '🤔' },
  { id: 'wow',         label: 'Wow',         emoji: '😮' },
  { id: 'goodluck',    label: 'Good Luck',   emoji: '🍀' },
  { id: 'thanks',      label: 'Thanks',      emoji: '🙏' },
  { id: 'hello',       label: 'Hello',       emoji: '👋' },
  { id: 'wp',          label: 'Well Played', emoji: '🏆' },
  { id: 'rush',        label: 'Hurry Up',    emoji: '⏰' },
  { id: 'deal',        label: 'Deal Me In',  emoji: '🃏' },
  { id: 'legendary',   label: 'Legendary',   emoji: '⭐' },
];

export const MAX_EQUIPPED_EMOTES = 8;

export function getEmote(id: string): Emote {
  return ALL_EMOTES.find(e => e.id === id) ?? ALL_EMOTES[0];
}
