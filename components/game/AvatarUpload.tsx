'use client';
import { useRef } from 'react';
import { getSocket } from '@/lib/socket/socketClient';

interface AvatarUploadProps {
  roomId: string;
  className?: string;
}

export default function AvatarUpload({ roomId, className = '' }: AvatarUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 150_000) {
      alert('Image too large. Please use an image under 150KB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      if (!dataUrl) return;
      const socket = getSocket();
      socket?.emit('player:setAvatar', { roomId, avatarUrl: dataUrl });
    };
    reader.readAsDataURL(file);
    // Reset input so same file can be re-selected
    e.target.value = '';
  };

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFile}
        className="hidden"
        id="avatar-upload-input"
      />
      <label
        htmlFor="avatar-upload-input"
        className="cursor-pointer text-[10px] text-slate-400 hover:text-slate-200 border border-slate-600 hover:border-slate-400 px-2 py-0.5 rounded transition-colors"
        title="Upload your profile photo"
      >
        📷 Photo
      </label>
    </div>
  );
}
