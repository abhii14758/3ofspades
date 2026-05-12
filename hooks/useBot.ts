'use client';
// Bot logic runs entirely on the server (socketServer.ts).
// This hook exists as a placeholder for future client-side bot
// visualisation and debugging (e.g. showing a "thinking…" indicator).

export function useBot() {
  return {
    isBotThinking: false,
  };
}
