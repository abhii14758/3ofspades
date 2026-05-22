'use client';
import { useState, useEffect, useRef } from 'react';
import { signOut } from 'next-auth/react';
import Link from 'next/link';
import AvatarDisplay from './AvatarDisplay';
import ImageCropModal from './ImageCropModal';
import { PRESET_AVATARS } from '@/config/avatars';
import { FRAMES } from '@/config/frames';
import { CARD_BACKS } from '@/config/cardBacks';
import { TABLE_THEMES } from '@/config/tableThemes';
import { ALL_EMOTES, MAX_EQUIPPED_EMOTES } from '@/config/emotes';
import { useSettingsStore } from '@/store/settingsStore';

interface Profile {
  id: string;
  email: string;
  displayName: string;
  bio: string;
  avatarUrl: string;
  avatarType: string;
  presetAvatarId: string;
  equippedFrameId: string;
  createdAt: string;
  stats: {
    gamesPlayed: number;
    gamesWon: number;
    totalPoints: number;
    totalTricks: number;
    winStreak: number;
    maxWinStreak: number;
  };
}

export default function ProfileClient({ userId, userEmail }: { userId: string; userEmail: string }) {
  const [tab, setTab] = useState<'profile' | 'cosmetics' | 'stats' | 'settings' | 'security'>('profile');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  // Editable fields
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [presetAvatarId, setPresetAvatarId] = useState('spade');
  const [avatarType, setAvatarType] = useState('preset');
  const [uploadedAvatarUrl, setUploadedAvatarUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [equippedFrameId, setEquippedFrameId] = useState('none');
  const [equippedCardBackId, setEquippedCardBackId] = useState('default');
  const [equippedTableThemeId, setEquippedTableThemeId] = useState('default');
  const [equippedEmoteIds, setEquippedEmoteIds] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);

  const { soundVolume, musicVolume, muted, language, setSoundVolume, setMusicVolume, setMuted, setLanguage } = useSettingsStore();

  // Security
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [pwMsg, setPwMsg] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwLoading, setPwLoading] = useState(false);

  // userId is used to scope the fetch; suppress the unused-var lint warning
  void userId;

  useEffect(() => {
    fetch('/api/profile')
      .then(r => r.json())
      .then(data => {
        setProfile(data);
        setDisplayName(data.displayName);
        setBio(data.bio ?? '');
        setPresetAvatarId(data.presetAvatarId ?? 'spade');
        setAvatarType(data.avatarType ?? 'preset');
            setUploadedAvatarUrl(data.avatarUrl ?? '');
            setEquippedFrameId(data.equippedFrameId ?? 'none');
            setEquippedCardBackId(data.equippedCardBackId ?? 'default');
            setEquippedTableThemeId(data.equippedTableThemeId ?? 'default');
            setEquippedEmoteIds(data.equippedEmoteIds ?? []);
            setLoading(false);
      });
  }, []);

  const handleSaveProfile = async () => {
    setSaving(true);
    setError('');
    setMsg('');
    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName, bio, presetAvatarId, avatarType, avatarUrl: uploadedAvatarUrl, equippedFrameId, equippedCardBackId, equippedTableThemeId, equippedEmoteIds }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error || 'Failed to save');
    } else {
      setMsg('Profile updated!');
      setProfile(p =>
        p ? { ...p, displayName: data.displayName, bio: data.bio, presetAvatarId: data.presetAvatarId } : p,
      );
      setTimeout(() => setMsg(''), 3000);
    }
  };

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setUploadError('Image too large (max 2MB)');
      return;
    }
    setUploadError('');
    const reader = new FileReader();
    reader.onload = () => setCropImageSrc(reader.result as string);
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCropComplete = async (croppedBlob: Blob) => {
    setCropImageSrc(null);
    setUploading(true);
    setUploadError('');
    const fd = new FormData();
    fd.append('file', croppedBlob, 'avatar.jpg');
    const res = await fetch('/api/profile/avatar', { method: 'POST', body: fd });
    const data = await res.json();
    setUploading(false);
    if (!res.ok) {
      setUploadError(data.error || 'Upload failed');
    } else {
      setUploadedAvatarUrl(data.avatarUrl);
      setAvatarType('upload');
      setProfile(p => p ? { ...p, avatarUrl: data.avatarUrl, avatarType: 'upload' } : p);
      setMsg('Avatar updated!');
      setTimeout(() => setMsg(''), 3000);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwLoading(true);
    setPwError('');
    setPwMsg('');
    const res = await fetch('/api/profile/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const data = await res.json();
    setPwLoading(false);
    if (!res.ok) {
      setPwError(data.error || 'Failed');
    } else {
      setPwMsg('Password changed successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setTimeout(() => setPwMsg(''), 3000);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-slate-400 animate-pulse">Loading profile…</div>
      </div>
    );
  }

  if (!profile) return null;

  const winRate =
    profile.stats.gamesPlayed > 0
      ? Math.round((profile.stats.gamesWon / profile.stats.gamesPlayed) * 100)
      : 0;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/lobby" className="text-slate-400 hover:text-slate-200 text-sm flex items-center gap-1.5">
            ← Back to Lobby
          </Link>
          <span className="text-sm font-semibold text-slate-300">My Profile</span>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="text-xs text-red-400 hover:text-red-300 transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Hero */}
        <div className="flex items-center gap-5 mb-8 p-5 bg-slate-900 border border-slate-800 rounded-2xl">
          <AvatarDisplay
            avatarType={avatarType}
            avatarUrl={uploadedAvatarUrl || profile.avatarUrl}
            presetAvatarId={presetAvatarId}
            equippedFrameId={equippedFrameId}
            size="2xl"
          />
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-black truncate">{profile.displayName}</h1>
            <p className="text-slate-400 text-sm mt-0.5">{userEmail}</p>
            {profile.bio && <p className="text-slate-300 text-sm mt-2 line-clamp-2">{profile.bio}</p>}
            <div className="flex gap-4 mt-3">
              <div className="text-center">
                <div className="text-lg font-bold text-violet-400">{profile.stats.gamesPlayed}</div>
                <div className="text-xs text-slate-500">Games</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-green-400">{winRate}%</div>
                <div className="text-xs text-slate-500">Win Rate</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-yellow-400">{profile.stats.totalPoints}</div>
                <div className="text-xs text-slate-500">Points</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-orange-400">{profile.stats.maxWinStreak}</div>
                <div className="text-xs text-slate-500">Best Streak</div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex bg-slate-800/60 rounded-xl p-1 mb-6 border border-slate-700/50">
          {(['profile', 'cosmetics', 'stats', 'settings', 'security'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold capitalize transition-all ${
                tab === t ? 'bg-violet-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {t === 'profile' ? '👤 Profile' : t === 'cosmetics' ? '🎨 Cosmetics' : t === 'stats' ? '📊 Stats' : t === 'settings' ? '⚙️ Settings' : '🔒 Security'}
            </button>
          ))}
        </div>

        {/* Profile Tab */}
        {tab === 'profile' && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Display Name</h2>
              <input
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                maxLength={20}
                minLength={2}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500"
              />
              <p className="text-xs text-slate-500 mt-1.5">{displayName.length}/20 characters</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Bio</h2>
              <textarea
                value={bio}
                onChange={e => setBio(e.target.value.slice(0, 160))}
                rows={3}
                placeholder="Tell other players about yourself…"
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500 resize-none"
              />
              <p className="text-xs text-slate-500 mt-1.5">{bio.length}/160 characters</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Avatar</h2>

              {/* Preset grid */}
              <p className="text-xs text-slate-500 mb-3">Choose a preset</p>
              <div className="grid grid-cols-6 gap-2 mb-5">
                {PRESET_AVATARS.map(av => (
                  <button
                    key={av.id}
                    onClick={() => {
                      setPresetAvatarId(av.id);
                      setAvatarType('preset');
                    }}
                    title={av.label}
                    className={`aspect-square rounded-full bg-gradient-to-br ${av.bg} flex items-center justify-center text-xl transition-all ${
                      avatarType === 'preset' && presetAvatarId === av.id
                        ? 'ring-2 ring-violet-400 ring-offset-2 ring-offset-slate-900 scale-110'
                        : 'opacity-70 hover:opacity-100 hover:scale-105'
                    }`}
                  >
                    {av.emoji}
                  </button>
                ))}
              </div>

              {/* Upload section */}
              <div className="border-t border-slate-700 pt-4">
                <p className="text-xs text-slate-500 mb-3">Or upload a custom photo (max 2MB)</p>
                <div className="flex items-center gap-3">
                  {avatarType === 'upload' && uploadedAvatarUrl && (
                    <AvatarDisplay avatarType="upload" avatarUrl={uploadedAvatarUrl} size="md" />
                  )}
                  <label className={`cursor-pointer flex-1 flex items-center justify-center gap-2 border border-dashed border-slate-600 hover:border-violet-500 rounded-lg py-2.5 px-4 text-sm transition-colors ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
                    <span className="text-slate-400">{uploading ? '⏳ Uploading…' : '📤 Choose image'}</span>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleAvatarSelect}
                    />
                  </label>
                  {avatarType === 'upload' && (
                    <button
                      onClick={() => setAvatarType('preset')}
                      className="text-xs text-slate-500 hover:text-red-400 transition-colors whitespace-nowrap"
                      title="Switch back to preset"
                    >
                      Use preset
                    </button>
                  )}
                </div>
                {uploadError && <p className="text-red-400 text-xs mt-2">{uploadError}</p>}
              </div>
            </div>

            {/* Frames picker */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-1">Avatar Frame</h2>
              <p className="text-xs text-slate-500 mb-3">All frames are free — pick your style</p>
              <div className="grid grid-cols-6 gap-2">
                {FRAMES.map(frame => {
                  const selected = equippedFrameId === frame.id;
                  return (
                    <button
                      key={frame.id}
                      onClick={() => setEquippedFrameId(frame.id)}
                      title={frame.label}
                      className={`aspect-square rounded-full flex items-center justify-center text-lg transition-all ${
                        selected
                          ? 'ring-2 ring-violet-400 ring-offset-2 ring-offset-slate-900 scale-110'
                          : 'opacity-70 hover:opacity-100 hover:scale-105'
                      }`}
                      style={{
                        background: frame.id === 'none'
                          ? '#1e293b'
                          : frame.gradient ?? frame.ringColor,
                        boxShadow: selected ? `0 0 10px ${frame.glowColor}` : undefined,
                      }}
                    >
                      {frame.overlayEmoji ?? '∅'}
                    </button>
                  );
                })}
              </div>
            </div>

            {error && (
              <p className="text-red-400 text-sm bg-red-950/30 border border-red-800/30 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
            {msg && (
              <p className="text-green-400 text-sm bg-green-950/30 border border-green-800/30 rounded-lg px-3 py-2">
                {msg}
              </p>
            )}
            <button
              onClick={handleSaveProfile}
              disabled={saving}
              className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl text-sm transition-colors"
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        )}

        {/* Cosmetics Tab */}
        {tab === 'cosmetics' && (
          <div className="space-y-6">
            {/* Card Backs */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-1">Card Back</h2>
              <p className="text-xs text-slate-500 mb-3">Pick the design shown on the back of your cards</p>
              <div className="grid grid-cols-4 gap-3">
                {CARD_BACKS.map(cb => {
                  const selected = equippedCardBackId === cb.id;
                  return (
                    <button
                      key={cb.id}
                      onClick={() => setEquippedCardBackId(cb.id)}
                      title={cb.label}
                      className={`aspect-[3/4] rounded-xl bg-gradient-to-br ${cb.gradient} flex flex-col items-center justify-center text-2xl transition-all ${
                        selected
                          ? 'ring-2 ring-violet-400 ring-offset-2 ring-offset-slate-900 scale-110'
                          : 'opacity-70 hover:opacity-100 hover:scale-105'
                      }`}
                    >
                      <span>{cb.pattern}</span>
                      <span className="text-[10px] text-white/70 mt-1 font-medium">{cb.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Table Themes */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-1">Table Theme</h2>
              <p className="text-xs text-slate-500 mb-3">Choose the felt color for your game table</p>
              <div className="grid grid-cols-6 gap-3">
                {TABLE_THEMES.map(theme => {
                  const selected = equippedTableThemeId === theme.id;
                  return (
                    <button
                      key={theme.id}
                      onClick={() => setEquippedTableThemeId(theme.id)}
                      title={theme.label}
                      className={`aspect-square rounded-xl bg-gradient-to-br ${theme.bg} flex flex-col items-center justify-center transition-all ${
                        selected
                          ? 'ring-2 ring-violet-400 ring-offset-2 ring-offset-slate-900 scale-110'
                          : 'opacity-70 hover:opacity-100 hover:scale-105'
                      }`}
                    >
                      <span className="text-[10px] text-white/80 font-medium mt-1">{theme.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Emote Selector */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-1">Quick Emotes</h2>
              <p className="text-xs text-slate-500 mb-3">Select up to {MAX_EQUIPPED_EMOTES} emotes for in-game quick chat</p>
              <p className="text-xs text-slate-400 mb-3 font-semibold">{equippedEmoteIds.length}/{MAX_EQUIPPED_EMOTES} selected</p>
              <div className="grid grid-cols-4 gap-2">
                {ALL_EMOTES.map(emote => {
                  const selected = equippedEmoteIds.includes(emote.id);
                  const atLimit = !selected && equippedEmoteIds.length >= MAX_EQUIPPED_EMOTES;
                  return (
                    <button
                      key={emote.id}
                      onClick={() => {
                        if (selected) {
                          setEquippedEmoteIds(ids => ids.filter(id => id !== emote.id));
                        } else if (!atLimit) {
                          setEquippedEmoteIds(ids => [...ids, emote.id]);
                        }
                      }}
                      disabled={atLimit}
                      title={emote.label}
                      className={`flex flex-col items-center justify-center py-3 rounded-lg border transition-all ${
                        selected
                          ? 'border-violet-500 bg-violet-600/20 text-white scale-105'
                          : atLimit
                          ? 'border-slate-700 bg-slate-800/50 text-slate-600 cursor-not-allowed'
                          : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-violet-500/50 hover:bg-slate-700'
                      }`}
                    >
                      <span className="text-xl">{emote.emoji}</span>
                      <span className="text-[10px] mt-1 font-medium text-slate-400">{emote.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {error && (
              <p className="text-red-400 text-sm bg-red-950/30 border border-red-800/30 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
            {msg && (
              <p className="text-green-400 text-sm bg-green-950/30 border border-green-800/30 rounded-lg px-3 py-2">
                {msg}
              </p>
            )}
            <button
              onClick={handleSaveProfile}
              disabled={saving}
              className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl text-sm transition-colors"
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        )}

        {/* Settings Tab */}
        {tab === 'settings' && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Audio</h2>
              <div className="space-y-5">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm text-slate-300">Sound Volume</label>
                    <span className="text-xs text-slate-500">{soundVolume}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={soundVolume}
                    onChange={e => setSoundVolume(Number(e.target.value))}
                    className="w-full accent-violet-500"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm text-slate-300">Music Volume</label>
                    <span className="text-xs text-slate-500">{musicVolume}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={musicVolume}
                    onChange={e => setMusicVolume(Number(e.target.value))}
                    className="w-full accent-violet-500"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-sm text-slate-300">Mute All</label>
                  <button
                    onClick={() => setMuted(!muted)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      muted ? 'bg-red-600' : 'bg-slate-600'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        muted ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Language</h2>
              <select
                value={language}
                onChange={e => setLanguage(e.target.value)}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500"
              >
                <option value="en">English</option>
              </select>
              <p className="text-xs text-slate-500 mt-1.5">More languages coming soon</p>
            </div>
          </div>
        )}

        {/* Stats Tab */}
        {tab === 'stats' && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Game Statistics</h2>
            {[
              { label: 'Games Played',   value: profile.stats.gamesPlayed,  color: 'text-violet-400' },
              { label: 'Games Won',      value: profile.stats.gamesWon,     color: 'text-green-400' },
              { label: 'Win Rate',       value: `${winRate}%`,              color: 'text-emerald-400' },
              { label: 'Total Points',   value: profile.stats.totalPoints,  color: 'text-yellow-400' },
              { label: 'Total Tricks',   value: profile.stats.totalTricks,  color: 'text-blue-400' },
              { label: 'Current Streak', value: profile.stats.winStreak,    color: 'text-orange-400' },
              { label: 'Best Streak',    value: profile.stats.maxWinStreak, color: 'text-red-400' },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex items-center justify-between py-2 border-b border-slate-800 last:border-0">
                <span className="text-slate-400 text-sm">{label}</span>
                <span className={`font-bold text-lg ${color}`}>{value}</span>
              </div>
            ))}
          </div>
        )}

        {/* Security Tab */}
        {tab === 'security' && (
          <div className="space-y-5">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Change Password</h2>
              <form onSubmit={handleChangePassword} className="space-y-3">
                <div>
                  <label className="block text-xs text-slate-500 mb-1.5">Current Password</label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={e => setCurrentPassword(e.target.value)}
                    required
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1.5">New Password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    required
                    minLength={8}
                    placeholder="Min. 8 characters"
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500"
                  />
                </div>
                {pwError && <p className="text-red-400 text-sm">{pwError}</p>}
                {pwMsg && <p className="text-green-400 text-sm">{pwMsg}</p>}
                <button
                  type="submit"
                  disabled={pwLoading}
                  className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-bold py-2.5 rounded-lg text-sm transition-colors"
                >
                  {pwLoading ? 'Updating…' : 'Update Password'}
                </button>
              </form>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Account</h2>
              <p className="text-xs text-slate-500 mb-4">
                Member since{' '}
                {new Date(profile.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </p>
              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="w-full border border-slate-600 hover:border-red-600 hover:text-red-400 text-slate-400 font-semibold py-2.5 rounded-lg text-sm transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        )}
      </div>
      {cropImageSrc && (
        <ImageCropModal
          imageSrc={cropImageSrc}
          onCropComplete={handleCropComplete}
          onCancel={() => setCropImageSrc(null)}
        />
      )}
    </div>
  );
}
