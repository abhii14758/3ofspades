'use client';
import { useCallback } from 'react';
import { useGameStore } from '@/store/gameStore';
import { usePlayerStore } from '@/store/playerStore';
import { socketEmit } from '@/lib/socket/socketClient';
import type { Suit } from '@/types';

export function useGame() {
  // Granular selectors — each component only re-renders for its slice
  const gameState           = useGameStore((s) => s.gameState);
  const myHand              = useGameStore((s) => s.myHand);
  const myCalledCards       = useGameStore((s) => s.myCalledCards);
  const showRoundResult     = useGameStore((s) => s.showRoundResult);
  const showWinner          = useGameStore((s) => s.showWinner);
  const lastRevealedPartner = useGameStore((s) => s.lastRevealedPartner);
  const dismissRoundResult  = useGameStore((s) => s.dismissRoundResult);

  const { playerId, roomId } = usePlayerStore();

  // Derive these inline — no store method calls
  const isMyTurn         = gameState?.currentTurnPlayerId === playerId;
  const canIBid          = gameState?.phase === 'bidding' && gameState?.currentTurnPlayerId === playerId;
  const canISelectTrump  = gameState?.phase === 'trump_selection' && gameState?.bidWinnerId === playerId;
  const canISelectPartners = gameState?.phase === 'partner_selection' && gameState?.bidWinnerId === playerId;

  const myPlayer = gameState?.players.find((p) => p.id === playerId);

  const teams = gameState?.teams;
  const myTeam = teams
    ? (teams.A.playerIds.includes(playerId ?? '') ? teams.A : teams.B.playerIds.includes(playerId ?? '') ? teams.B : undefined)
    : undefined;
  const opponentTeam = teams && myTeam
    ? (myTeam.id === 'A' ? teams.B : teams.A)
    : undefined;

  const playCard = useCallback((cardId: string) => {
    if (!roomId) return;
    socketEmit.playCard({ roomId, cardId });
  }, [roomId]);

  const placeBid = useCallback((amount: number | 'pass') => {
    if (!roomId) return;
    socketEmit.placeBid({ roomId, amount });
  }, [roomId]);

  const selectTrump = useCallback((suit: Suit) => {
    if (!roomId) return;
    socketEmit.selectTrump({ roomId, suit });
  }, [roomId]);

  const selectPartners = useCallback((slots: Array<{ typeId: string; ordinal: 1 | 2 }>) => {
    if (!roomId) return;
    socketEmit.selectPartners({
      roomId,
      cardIds: slots.map(s => s.typeId),
      cardSlots: slots,
    });
  }, [roomId]);

  const startNextRound = useCallback(() => {
    if (!roomId) return;
    socketEmit.startNextRound(roomId);
  }, [roomId]);

  return {
    gameState,
    myHand,
    myCalledCards,
    isMyTurn,
    canIBid,
    canISelectTrump,
    canISelectPartners,
    myTeam,
    opponentTeam,
    myPlayer,
    playerId,
    roomId,
    showRoundResult,
    showWinner,
    lastRevealedPartner,
    dismissRoundResult,
    playCard,
    placeBid,
    selectTrump,
    selectPartners,
    startNextRound,
  };
}
