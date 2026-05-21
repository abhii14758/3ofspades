'use client';
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';

interface ActiveGameState {
  activeRoomId: string | null;
  loading: boolean;
}

export function useActiveGame(): ActiveGameState {
  const { data: session, status } = useSession();
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status !== 'authenticated' || !session?.user) {
      setLoading(false);
      return;
    }

    fetch('/api/game/active')
      .then(r => r.ok ? r.json() : { activeRoomId: null })
      .then(data => {
        setActiveRoomId(data.activeRoomId ?? null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [session, status]);

  return { activeRoomId, loading };
}
