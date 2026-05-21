import { getPresetAvatar } from '@/config/avatars';

interface AvatarDisplayProps {
  avatarType: string;
  avatarUrl?: string;
  presetAvatarId?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | number;
  className?: string;
}

const NAMED_SIZES = {
  sm: 'w-8 h-8 text-base',
  md: 'w-10 h-10 text-xl',
  lg: 'w-16 h-16 text-3xl',
  xl: 'w-24 h-24 text-5xl',
};

export default function AvatarDisplay({
  avatarType,
  avatarUrl,
  presetAvatarId = 'spade',
  size = 'md',
  className = '',
}: AvatarDisplayProps) {
  const isNumeric = typeof size === 'number';
  const sizeClass = isNumeric ? '' : NAMED_SIZES[size as keyof typeof NAMED_SIZES];
  const sizeStyle = isNumeric ? { width: size, height: size, fontSize: size * 0.45 } : undefined;

  if (avatarType === 'upload' && avatarUrl) {
    return (
      <div className={`${sizeClass} rounded-full overflow-hidden flex-shrink-0 ${className}`} style={sizeStyle}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
      </div>
    );
  }

  const preset = getPresetAvatar(presetAvatarId);
  return (
    <div
      className={`${sizeClass} rounded-full bg-gradient-to-br ${preset.bg} flex items-center justify-center flex-shrink-0 ${className}`}
      style={sizeStyle}
    >
      <span>{preset.emoji}</span>
    </div>
  );
}
