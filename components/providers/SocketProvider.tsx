'use client';
import { useSocket } from '@/hooks/useSocket';

/**
 * Mounts the socket connection and registers ALL server→client event
 * listeners once at the root layout level. This ensures listeners are
 * active regardless of which page the user navigates to first.
 */
export default function SocketProvider({ children }: { children: React.ReactNode }) {
  useSocket();
  return <>{children}</>;
}
