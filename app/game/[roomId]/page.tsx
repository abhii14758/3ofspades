'use client';
import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import GameTable from '@/components/game/GameTable';
import RoundResult from '@/components/game/RoundResult';
import WinnerScreen from '@/components/game/WinnerScreen';
import { useGame } from '@/hooks/useGame';
import { connectSocket, socketEmit } from '@/lib/socket/socketClient';
import { useLobbyStore } from '@/store/lobbyStore';
import { getConfigForPreset } from '@/config/gameConfig';
import type { Card, Suit } from '@/types';

export default function GamePage() {
  const { roomId } = useParams<{ roomId: string }>();
  const router = useRouter();

  const {
    gameState,
    myHand,
    playerId,
    showRoundResult,
    showWinner,
    dismissRoundResult,
    playCard,
    placeBid,
    selectTrump,
    selectPartners,
    startNextRound,
  } = useGame();

  const currentRoom = useLobbyStore((s) => s.currentRoom);
  const preset = currentRoom?.config?.preset ?? '6p1d';
  const roomGameConfig = getConfigForPreset(preset);

  // Ensure socket is alive if the user navigated directly to this URL (e.g. refresh)
  useEffect(() => {
    connectSocket();
  }, []);

  // Loading / reconnecting state
  if (!gameState) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center text-slate-400">
          <div className="text-6xl animate-pulse mb-4">♠</div>
          <p className="text-base font-semibold">Loading game…</p>
          <p className="text-xs text-slate-600 mt-1 font-mono">room: {roomId}</p>
          <button
            onClick={() => router.push('/')}
            className="mt-6 text-xs text-slate-600 hover:text-slate-400 underline transition-colors"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  const handlePlayCard = (card: Card) => playCard(card.id);
  const handleBid = (amount: number) => placeBid(amount);
  const handlePass = () => placeBid('pass');
  const handleSelectTrump = (suit: Suit) => selectTrump(suit);
  const handleSelectPartners = (ids: string[]) => selectPartners(ids);

  const lastRoundHistory =
    gameState.roundHistory.length > 0
      ? gameState.roundHistory[gameState.roundHistory.length - 1]
      : null;

  const myPlayer = gameState.players.find((p) => p.id === playerId);
  const isHost = myPlayer?.isHost ?? false;
  const handleTerminate = () => {
    if (roomId) socketEmit.terminateGame(roomId);
  };

  return (
    <>
      <GameTable
        gameState={gameState}
        myPlayerId={playerId ?? ''}
        myHand={myHand}
        onPlayCard={handlePlayCard}
        onBid={handleBid}
        onPass={handlePass}
        onSelectTrump={handleSelectTrump}
        onSelectPartners={handleSelectPartners}
        isHost={isHost}
        onTerminate={handleTerminate}
        partnerCount={roomGameConfig.partnerCount}
        maxBid={roomGameConfig.totalRoundPoints}
        totalTricks={roomGameConfig.totalTricks}
        turnTimerTotalSeconds={currentRoom?.config?.turnTimerSeconds ?? 30}
        deckCount={roomGameConfig.deckCount}
      />

      {showRoundResult && lastRoundHistory && gameState.teams && (
        <RoundResult
          roundHistory={lastRoundHistory}
          teams={gameState.teams}
          players={gameState.players}
          playerTotals={gameState.playerTotals ?? {}}
          winnerTeamId={gameState.winnerTeamId}
          myPlayerId={playerId ?? ''}
          isHost={gameState.players.find((p) => p.id === playerId)?.isHost ?? false}
          onStartNextRound={startNextRound}
          onDismiss={dismissRoundResult}
        />
      )}

      {showWinner && gameState.winnerTeamId && gameState.teams && (
        <WinnerScreen
          winnerTeamId={gameState.winnerTeamId}
          teams={gameState.teams}
          players={gameState.players}
          playerTotals={gameState.playerTotals ?? {}}
          roundHistory={gameState.roundHistory}
          onHome={() => router.push('/')}
          onPlayAgain={() => router.push('/lobby')}
        />
      )}
    </>
  );
}
