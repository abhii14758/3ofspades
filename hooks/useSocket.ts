'use client';
import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { connectSocket, getSocket } from '@/lib/socket/socketClient';
import { usePlayerStore } from '@/store/playerStore';
import { useLobbyStore } from '@/store/lobbyStore';
import { useGameStore } from '@/store/gameStore';
import type {
  Room,
  Player,
  GameState,
  BidState,
  Suit,
  Trick,
  Team,
  TeamId,
  Card,
  RoundHistory,
  CalledCardSlot,
} from '@/types';

export function useSocket() {
  const router = useRouter();
  const initialized = useRef(false);

  const { setPlayerId, setRoomId } = usePlayerStore();
  const { setRoom, updateRoom, setConnected, setConnecting, setError } = useLobbyStore();
  const gameStore = useGameStore();

  useEffect(() => {
    // Guard against double-registration (React StrictMode / re-renders)
    if (initialized.current) return;
    initialized.current = true;

    const socket = connectSocket();

    // ------------------------------------------------------------------
    // Connection lifecycle
    // ------------------------------------------------------------------
    socket.on('connect', () => {
      setConnected(true);
      setConnecting(false);

      // Re-attach to an in-progress room after a reconnect
      const { userId, roomId: storedRoomId } = usePlayerStore.getState();
      if (userId && storedRoomId) {
        socket.emit('player:reconnect', {
          roomId: storedRoomId,
          playerId: userId,
        });
      }
    });

    socket.on('disconnect', () => setConnected(false));

    // ------------------------------------------------------------------
    // Room events
    // ------------------------------------------------------------------
    socket.on(
      'room:created',
      ({ room, playerId: pid }: { room: Room; playerId: string }) => {
        setPlayerId(pid);
        setRoomId(room.id);
        setRoom(room);
        router.push(`/room/${room.id}`);
      }
    );

    socket.on(
      'room:joined',
      ({ room, playerId: pid }: { room: Room; playerId: string }) => {
        setPlayerId(pid);
        setRoomId(room.id);
        setRoom(room);
        router.push(`/room/${room.id}`);
      }
    );

    socket.on('room:updated', ({ room }: { room: Room }) => updateRoom(room));

    socket.on('room:error', ({ message }: { message: string }) => {
      setError(message);
      toast.error(message);
    });

    // ------------------------------------------------------------------
    // Game lifecycle
    // ------------------------------------------------------------------
    socket.on('game:started', ({ gameState }: { gameState: GameState }) => {
      gameStore.reset();
      gameStore.setGameState(gameState);
      router.push(`/game/${gameState.roomId}`);
    });

    socket.on('game:stateSync', ({ gameState }: { gameState: GameState }) => {
      gameStore.setGameState(gameState);
      // Navigate to game page if not already there (handles reconnect scenarios)
      if (gameState.roomId && typeof window !== 'undefined') {
        const currentPath = window.location.pathname;
        if (!currentPath.startsWith('/game/')) {
          router.push(`/game/${gameState.roomId}`);
        }
      }
    });

    socket.on('game:dealComplete', ({ gameState }: { gameState: GameState }) => {
      gameStore.setGameState(gameState);
    });

    // ------------------------------------------------------------------
    // Player private events
    // ------------------------------------------------------------------
    socket.on('player:hand', ({ cards }: { cards: Card[] }) => {
      gameStore.setMyHand(cards);
    });

    socket.on('player:calledCards', ({ cards, slots }: { cards: Card[]; slots?: CalledCardSlot[] }) => {
      gameStore.setMyCalledCards(cards);
      if (slots) gameStore.setMyCalledCardSlots(slots);
      toast.success('Partner cards selected! Keep them secret.');
    });

    // ------------------------------------------------------------------
    // Bidding
    // ------------------------------------------------------------------
    socket.on(
      'game:bidUpdate',
      ({
        bidState,
        currentTurnPlayerId,
      }: {
        bidState: BidState;
        currentTurnPlayerId: string;
      }) => {
        gameStore.updateBidState(bidState, currentTurnPlayerId);
        const state = useGameStore.getState().gameState;
        const bidder = state?.players.find((p) => p.id === currentTurnPlayerId);
        if (bidder) toast(`${bidder.name}'s turn to bid`, { icon: '🃏' });
      }
    );

    // ------------------------------------------------------------------
    // Trump & partner selection
    // ------------------------------------------------------------------
    socket.on(
      'game:trumpSelected',
      ({
        trumpSuit,
        currentTurnPlayerId,
      }: {
        trumpSuit: Suit;
        currentTurnPlayerId: string;
      }) => {
        gameStore.updateTrump(trumpSuit, currentTurnPlayerId);
        const suitSymbols: Record<string, string> = {
          spades: '♠',
          hearts: '♥',
          diamonds: '♦',
          clubs: '♣',
        };
        toast.success(`Trump: ${suitSymbols[trumpSuit]} ${trumpSuit.toUpperCase()}`);
      }
    );

    socket.on('game:partnerSelectionNeeded', () => {
      toast('Select your 2 partner cards!', { icon: '🤝', duration: 5000 });
    });

    // ------------------------------------------------------------------
    // Trick play
    // ------------------------------------------------------------------
    socket.on(
      'game:cardPlayed',
      ({
        playerId: pid,
        card,
        trick,
      }: {
        playerId: string;
        card: Card;
        trick: Trick;
      }) => {
        gameStore.applyCardPlayed(pid, card, trick);
      }
    );

    socket.on(
      'game:trickComplete',
      ({
        trick,
        winnerId,
        nextTurnPlayerId,
        teams,
      }: {
        trick: Trick;
        winnerId: string;
        nextTurnPlayerId: string;
        teams: { A: Team; B: Team };
      }) => {
        gameStore.applyTrickComplete(trick, winnerId, nextTurnPlayerId, teams);
        const state = useGameStore.getState().gameState;
        const winner = state?.players.find((p) => p.id === winnerId);
        if (winner) toast(`${winner.name} wins the trick!`, { icon: '✅' });
      }
    );

    socket.on(
      'game:partnerRevealed',
      ({
        playerId: pid,
        card,
        partnerName,
        calledCardSlots,
      }: {
        playerId: string;
        card: Card;
        partnerName: string;
        calledCardSlots?: CalledCardSlot[];
      }) => {
        gameStore.applyPartnerRevealed(pid, card, partnerName, calledCardSlots);
        toast.success(`🎉 Partner revealed: ${partnerName}!`, { duration: 4000 });
      }
    );

    // ------------------------------------------------------------------
    // Round / game end
    // ------------------------------------------------------------------
    socket.on(
      'game:roundEnd',
      ({
        roundHistory,
        teams,
        winnerTeamId,
        playerTotals,
      }: {
        roundHistory: RoundHistory;
        teams: { A: Team; B: Team };
        winnerTeamId: TeamId | null;
        playerTotals?: Record<string, number>;
      }) => {
        gameStore.setRoundEnd(roundHistory, teams, winnerTeamId, playerTotals);
      }
    );

    socket.on(
      'game:end',
      ({
        winnerTeamId,
        teams,
        playerTotals,
      }: {
        winnerTeamId: TeamId;
        teams: { A: Team; B: Team };
        roundHistory: RoundHistory[];
        playerTotals?: Record<string, number>;
      }) => {
        gameStore.setGameEnd(winnerTeamId, teams, playerTotals);
        toast.success(`🏆 Team ${winnerTeamId} wins the game!`, { duration: 8000 });
      }
    );

    // ------------------------------------------------------------------
    // Timer & termination
    // ------------------------------------------------------------------
    socket.on(
      'game:turnTimerUpdate',
      ({ remainingSeconds, endsAt }: { remainingSeconds: number; endsAt?: number }) => {
        const endTime = endsAt ?? (Date.now() + remainingSeconds * 1000);
        gameStore.setTurnTimer(endTime);
        const currentState = useGameStore.getState().gameState;
        if (currentState) {
          gameStore.setGameState({ ...currentState, turnTimerEndsAt: endTime });
        }
      }
    );

    socket.on(
      'game:turnTimerExpired',
      ({ playerId: timedOutPlayerId }: { playerId: string }) => {
        const state = useGameStore.getState().gameState;
        const player = state?.players.find((p) => p.id === timedOutPlayerId);
        if (player) toast(`⏰ ${player.name}'s time is up!`, { icon: '⚠️' });
      }
    );

    socket.on('game:terminated', ({ message }: { message: string }) => {
      toast.error(message ?? 'Game was terminated');
      gameStore.reset();
      router.push('/');
    });

    socket.on('room:blackout', () => {
      gameStore.setBlackout(true);
    });

    socket.on('room:blackoutReveal', () => {
      gameStore.setBlackout(false);
    });

    socket.on('room:blackoutCount', ({ count, names }: { count: number; names: string[] }) => {
      gameStore.setBlackoutCount(count, names);
    });

    socket.on('game:nextRoundReady', () => {
      // Server started next round — gameState will be updated via game:started
    });

    socket.on('room:playerUpdate', ({ players }: { players: Player[] }) => {
      const currentState = useGameStore.getState().gameState;
      if (currentState) {
        useGameStore.getState().setGameState({ ...currentState, players });
      }
    });

    socket.on('room:hostTransferred', ({ newHostId, newHostName }: { newHostId: string; newHostName: string }) => {
      const { playerId } = usePlayerStore.getState();
      if (playerId === newHostId) {
        toast.success(`You are now the host!`);
      } else {
        toast(`${newHostName} is now the host`, { icon: '👑' });
      }
    });

    // ------------------------------------------------------------------
    // Cleanup
    // ------------------------------------------------------------------
    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('room:created');
      socket.off('room:joined');
      socket.off('room:updated');
      socket.off('room:error');
      socket.off('room:playerUpdate');
      socket.off('game:started');
      socket.off('game:stateSync');
      socket.off('game:dealComplete');
      socket.off('player:hand');
      socket.off('player:calledCards');
      socket.off('game:bidUpdate');
      socket.off('game:trumpSelected');
      socket.off('game:partnerSelectionNeeded');
      socket.off('game:cardPlayed');
      socket.off('game:trickComplete');
      socket.off('game:partnerRevealed');
      socket.off('game:roundEnd');
      socket.off('game:end');
      socket.off('game:turnTimerUpdate');
      socket.off('game:turnTimerExpired');
      socket.off('game:terminated');
      socket.off('game:nextRoundReady');
      socket.off('room:blackout');
      socket.off('room:blackoutReveal');
      socket.off('room:blackoutCount');
      socket.off('room:hostTransferred');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return getSocket();
}
