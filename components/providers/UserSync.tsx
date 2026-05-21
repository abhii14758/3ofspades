'use client';
import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { usePlayerStore } from '@/store/playerStore';

export default function UserSync() {
  const { data: session } = useSession();
  const setUserId = usePlayerStore((s) => s.setUserId);
  const setPlayerName = usePlayerStore((s) => s.setPlayerName);

  useEffect(() => {
    if (!session?.user) return;
    const user = session.user as { id?: string; name?: string | null };
    if (user.id) setUserId(user.id);
    if (user.name) setPlayerName(user.name);
  }, [session, setUserId, setPlayerName]);

  return null;
}
