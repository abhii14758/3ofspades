'use client';
import { useGameStore } from '@/store/gameStore';
import { usePlayerStore } from '@/store/playerStore';
import { socketEmit } from '@/lib/socket/socketClient';
import type { Suit } from '@/types';

export function useGame() {
  const gameStore = useGameStore();
  const { playerId, roomId } = usePlayerStore();

  const gameState = gameStore.gameState;
  const myHand = gameStore.myHand;
  const isMyTurn = gameStore.isMyTurn(playerId ?? '');
  const canIBid = gameStore.canIBid(playerId ?? '');
  const canISelectTrump = gameStore.canISelectTrump(playerId ?? '');
  const canISelectPartners = gameStore.canISelectPartners(playerId ?? '');
  const myTeam = gameStore.getMyTeam(playerId ?? '');
  const opponentTeam = gameStore.getOpponentTeam(playerId ?? '');
  const myPlayer = gameState?.players.find((p) => p.id === playerId);

  const playCard = (cardId: string) => {
    if (!roomId) return;
    socketEmit.playCard({ roomId, cardId });
  };

  const placeBid = (amount: number | 'pass') => {
    if (!roomId) return;
    socketEmit.placeBid({ roomId, amount });
  };

  const selectTrump = (suit: Suit) => {
    if (!roomId) return;
    socketEmit.selectTrump({ roomId, suit });
  };

  const selectPartners = (slots: Array<{ typeId: string; ordinal: 1 | 2 }>) => {
    if (!roomId) return;
    socketEmit.selectPartners({
      roomId,
      cardIds: slots.map(s => s.typeId),  // backward compat
      cardSlots: slots,
    });
  };

  const startNextRound = () => {
    if (!roomId) return;
    socketEmit.startNextRound(roomId);
  };

  return {
    gameState,
    myHand,
    myCalledCards: gameStore.myCalledCards,
    isMyTurn,
    canIBid,
    canISelectTrump,
    canISelectPartners,
    myTeam,
    opponentTeam,
    myPlayer,
    playerId,
    roomId,
    showRoundResult: gameStore.showRoundResult,
    showWinner: gameStore.showWinner,
    lastRevealedPartner: gameStore.lastRevealedPartner,
    dismissRoundResult: gameStore.dismissRoundResult,
    playCard,
    placeBid,
    selectTrump,
    selectPartners,
    startNextRound,
  };
}
