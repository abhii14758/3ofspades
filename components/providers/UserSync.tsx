'use client';
import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { usePlayerStore } from '@/store/playerStore';

export default function UserSync() {
  const { data: session } = useSession();
  const setUserId = usePlayerStore((s) => s.setUserId);
  const setPlayerName = usePlayerStore((s) => s.setPlayerName);
  const setPlayerId = usePlayerStore((s) => s.setPlayerId);
  const setRoomId = usePlayerStore((s) => s.setRoomId);

  useEffect(() => {
    if (!session?.user) return;
    const user = session.user as { id?: string; name?: string | null };
    if (user.id) {
      setUserId(user.id);
      setPlayerId(user.id);
    }
    if (user.name) setPlayerName(user.name);

    // Check for active game — populate roomId so reconnect can fire
    fetch('/api/game/active')
      .then(r => r.ok ? r.json() : { activeRoomId: null })
      .then(data => {
        if (data.activeRoomId) {
          setRoomId(data.activeRoomId);
        }
      })
      .catch(() => {});
  }, [session, setUserId, setPlayerName, setPlayerId, setRoomId]);

  return null;
}
