import { getPresetAvatar } from '@/config/avatars';
import { getFrame } from '@/config/frames';

interface AvatarDisplayProps {
  avatarType: string;
  avatarUrl?: string;
  presetAvatarId?: string;
  equippedFrameId?: string;
  disableFrameRing?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | number;
  className?: string;
}

const NAMED_SIZES = {
  sm: 'w-8 h-8 text-base',
  md: 'w-10 h-10 text-xl',
  lg: 'w-16 h-16 text-3xl',
  xl: 'w-32 h-32 text-5xl',
  '2xl': 'w-48 h-48 text-7xl',
};

const NAMED_PX: Record<string, number> = { sm: 32, md: 40, lg: 64, xl: 128, '2xl': 192 };

export default function AvatarDisplay({
  avatarType,
  avatarUrl,
  presetAvatarId = 'spade',
  equippedFrameId,
  disableFrameRing = false,
  size = 'md',
  className = '',
}: AvatarDisplayProps) {
  const isNumeric = typeof size === 'number';
  const sizeClass = isNumeric ? '' : NAMED_SIZES[size as keyof typeof NAMED_SIZES];
  const sizePx = isNumeric ? size : NAMED_PX[size as keyof typeof NAMED_PX] ?? 40;
  const sizeStyle = isNumeric ? { width: size, height: size, fontSize: size * 0.45 } : undefined;

  const frame = equippedFrameId && equippedFrameId !== 'none' ? getFrame(equippedFrameId) : null;
  const showRing = frame && !disableFrameRing;
  const showOverlay = !!frame?.overlayEmoji;

  const overlaySize = Math.max(10, Math.round(sizePx * 0.28));

  const avatarContent = (() => {
    if (avatarType === 'upload' && avatarUrl) {
      return (
        <div className={`${sizeClass} rounded-full overflow-hidden flex-shrink-0`} style={sizeStyle}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
        </div>
      );
    }
    const preset = getPresetAvatar(presetAvatarId);
    return (
      <div
        className={`${sizeClass} rounded-full bg-gradient-to-br ${preset.bg} flex items-center justify-center flex-shrink-0`}
        style={sizeStyle}
      >
        <span>{preset.emoji}</span>
      </div>
    );
  })();

  if (!showRing && !showOverlay) {
    return <div className={className}>{avatarContent}</div>;
  }

  const pad = isNumeric ? 2.5 : 2;

  return (
    <div className={`relative flex-shrink-0 ${className}`} style={{ display: 'inline-flex' }}>
      {showRing ? (
        <div
          style={{
            background: frame.gradient ?? frame.ringColor,
            padding: pad,
            borderRadius: '50%',
            boxShadow: `0 0 12px ${frame.glowColor}`,
          }}
        >
          {avatarContent}
        </div>
      ) : avatarContent}

      {showOverlay && (
        <span
          style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            fontSize: overlaySize,
            lineHeight: 1,
            background: frame.overlayBg ?? '#1a1a1a',
            borderRadius: '50%',
            padding: 1,
            pointerEvents: 'none',
          }}
        >
          {frame.overlayEmoji}
        </span>
      )}
    </div>
  );
}

