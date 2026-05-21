'use client';
import { useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { usePlayerStore } from '@/store/playerStore';
import { disconnectSocket, connectSocket } from '@/lib/socket/socketClient';

export default function UserSync() {
  const { data: session } = useSession();
  const setUserId = usePlayerStore((s) => s.setUserId);
  const setPlayerName = usePlayerStore((s) => s.setPlayerName);
  const setPlayerId = usePlayerStore((s) => s.setPlayerId);
  const setRoomId = usePlayerStore((s) => s.setRoomId);
  const prevUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!session?.user) return;
    const user = session.user as { id?: string; name?: string | null };
    if (user.id) {
      setUserId(user.id);
      setPlayerId(user.id);

      // If the user just logged in (transition from no userId to having one),
      // force a socket reconnect so the auth middleware picks up the JWT cookie.
      if (!prevUserIdRef.current) {
        disconnectSocket();
        // Small delay to ensure disconnect completes before reconnecting
        setTimeout(() => connectSocket(), 100);
      }
      prevUserIdRef.current = user.id;
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
