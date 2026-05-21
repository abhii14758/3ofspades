export interface TableTheme {
  id: string;
  label: string;
  bg: string;
  borderColor: string;
  feltColor: string;
}

export const TABLE_THEMES: TableTheme[] = [
  { id: 'default', label: 'Green Felt',   bg: 'from-green-950 to-green-900',    borderColor: 'border-green-800', feltColor: '#1a472a' },
  { id: 'midnight', label: 'Midnight Blue', bg: 'from-blue-950 to-indigo-900',  borderColor: 'border-blue-800',  feltColor: '#0f1b3d' },
  { id: 'royal',   label: 'Royal Purple', bg: 'from-purple-950 to-violet-900', borderColor: 'border-purple-800', feltColor: '#2d1b4e' },
  { id: 'sunset',  label: 'Sunset',       bg: 'from-orange-950 to-red-900',    borderColor: 'border-orange-800', feltColor: '#3d1a0a' },
  { id: 'noir',    label: 'Noir',         bg: 'from-gray-950 to-slate-900',    borderColor: 'border-gray-700',   feltColor: '#111827' },
  { id: 'arctic',  label: 'Arctic',       bg: 'from-cyan-950 to-slate-900',    borderColor: 'border-cyan-800',   feltColor: '#0c2d3e' },
];

export function getTableTheme(id: string): TableTheme {
  return TABLE_THEMES.find(t => t.id === id) ?? TABLE_THEMES[0];
}
