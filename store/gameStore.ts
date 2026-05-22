'use client';
import { create } from 'zustand';
import type {
  GameState,
  Card,
  BidState,
  Trick,
  Team,
  TeamId,
  Suit,
  RoundHistory,
  Player,
  CalledCardSlot,
} from '@/types';

export interface ActiveEmote {
  playerId: string;
  emote: string;
  timestamp: number;
}

interface GameStore {
  gameState: GameState | null;
  myHand: Card[];
  myCalledCards: Card[];
  myCalledCardSlots: CalledCardSlot[];
  lastPlayedCard: { playerId: string; card: Card } | null;
  lastRevealedPartner: { playerId: string; partnerName: string } | null;
  showRoundResult: boolean;
  showWinner: boolean;
  turnTimerEndsAt: number | null;
  isBlackout: boolean;
  blackoutCount: number;
  blackoutVoterNames: string[];
  activeEmotes: Record<string, ActiveEmote>;

  // Setters driven by socket events
  setGameState: (state: GameState) => void;
  setBlackout: (on: boolean) => void;
  setBlackoutCount: (count: number, names: string[]) => void;
  setMyHand: (cards: Card[]) => void;
  setMyCalledCards: (cards: Card[]) => void;
  setMyCalledCardSlots: (slots: CalledCardSlot[]) => void;
  updateBidState: (bidState: BidState, currentTurnPlayerId: string) => void;
  updateTrump: (trumpSuit: Suit, currentTurnPlayerId: string) => void;
  setTurnTimer: (endsAt: number | null) => void;
  applyCardPlayed: (playerId: string, card: Card, trick: Trick) => void;
  applyTrickComplete: (
    trick: Trick,
    winnerId: string,
    nextTurnPlayerId: string,
    teams: { A: Team; B: Team }
  ) => void;
  applyPartnerRevealed: (playerId: string, card: Card, partnerName: string, calledCardSlots?: CalledCardSlot[]) => void;
  setRoundEnd: (
    roundHistory: RoundHistory,
    teams: { A: Team; B: Team },
    winnerTeamId: TeamId | null,
    playerTotals?: Record<string, number>
  ) => void;
  setGameEnd: (winnerTeamId: TeamId, teams: { A: Team; B: Team }, playerTotals?: Record<string, number>) => void;
  dismissRoundResult: () => void;
  showEmote: (playerId: string, emote: string) => void;
  reset: () => void;

  // Derived selectors
  getMyPlayer: (myPlayerId: string) => Player | undefined;
  isMyTurn: (myPlayerId: string) => boolean;
  canIBid: (myPlayerId: string) => boolean;
  canISelectTrump: (myPlayerId: string) => boolean;
  canISelectPartners: (myPlayerId: string) => boolean;
  getMyTeam: (myPlayerId: string) => Team | undefined;
  getOpponentTeam: (myPlayerId: string) => Team | undefined;
}

const initialState = {
  gameState: null,
  myHand: [] as Card[],
  myCalledCards: [] as Card[],
  myCalledCardSlots: [] as CalledCardSlot[],
  lastPlayedCard: null,
  lastRevealedPartner: null,
  showRoundResult: false,
  showWinner: false,
  turnTimerEndsAt: null as number | null,
  isBlackout: false,
  blackoutCount: 0,
  blackoutVoterNames: [] as string[],
  activeEmotes: {} as Record<string, ActiveEmote>,
};

export const useGameStore = create<GameStore>()((set, get) => ({
  ...initialState,

  // -------------------------------------------------------------------------
  // Setters
  // -------------------------------------------------------------------------

  setGameState: (state) => set({ gameState: state }),

  setBlackout: (on) => set({ isBlackout: on, ...(on ? {} : { blackoutCount: 0, blackoutVoterNames: [] }) }),

  setBlackoutCount: (count, names) => set({ blackoutCount: count, blackoutVoterNames: names }),

  setMyHand: (cards) => set({ myHand: cards }),

  setMyCalledCards: (cards) => set({ myCalledCards: cards }),

  setMyCalledCardSlots: (slots) => set({ myCalledCardSlots: slots }),

  updateBidState: (bidState, currentTurnPlayerId) =>
    set((s) => ({
      gameState: s.gameState
        ? {
            ...s.gameState,
            bidState,
            currentTurnPlayerId,
            phase: bidState.winnerId ? 'trump_selection' as const : s.gameState.phase,
            bidWinnerId: bidState.winnerId ?? s.gameState.bidWinnerId,
          }
        : null,
    })),

  updateTrump: (trumpSuit, currentTurnPlayerId) =>
    set((s) => ({
      gameState: s.gameState
        ? { ...s.gameState, trumpSuit, currentTurnPlayerId, phase: 'partner_selection' as const }
        : null,
    })),

  /**
   * Update the current trick with the newly played card.
   * If the card being played is in myHand (i.e. this is the local player's
   * card), remove it from the hand.
   */
  applyCardPlayed: (playerId, card, trick) =>
    set((s) => {
      const cardInHand = s.myHand.some((c) => c.id === card.id);
      return {
        gameState: s.gameState
          ? { ...s.gameState, currentTrick: trick }
          : null,
        lastPlayedCard: { playerId, card },
        myHand: cardInHand ? s.myHand.filter((c) => c.id !== card.id) : s.myHand,
      };
    }),

  /**
   * Move the completed trick into completedTricks, reset currentTrick,
   * and update team scores + turn pointer.
   */
  applyTrickComplete: (trick, winnerId, nextTurnPlayerId, teams) =>
    set((s) => {
      if (!s.gameState) return {};
      const completedTricks = [...s.gameState.completedTricks, trick];
      return {
        gameState: {
          ...s.gameState,
          currentTrick: null,
          completedTricks,
          currentTurnPlayerId: nextTurnPlayerId,
          teams,
        },
      };
    }),

  applyPartnerRevealed: (playerId, _card, partnerName, calledCardSlots?) =>
    set((s) => ({
      lastRevealedPartner: { playerId, partnerName },
      gameState: s.gameState ? {
        ...s.gameState,
        revealedPartnerIds: [...(s.gameState.revealedPartnerIds ?? []), playerId],
        partnerIds: [...(s.gameState.partnerIds ?? []), playerId],
        calledCardSlots: calledCardSlots ?? s.gameState.calledCardSlots,
      } : null,
    })),

  setRoundEnd: (roundHistory, teams, winnerTeamId, playerTotals?) =>
    set((s) => ({
      gameState: s.gameState
        ? {
            ...s.gameState,
            phase: 'round_end' as const,
            teams,
            winnerTeamId,
            roundHistory: [...s.gameState.roundHistory, roundHistory],
            playerTotals: playerTotals ?? s.gameState.playerTotals,
          }
        : null,
      showRoundResult: true,
    })),

  setGameEnd: (winnerTeamId, teams, playerTotals?) =>
    set((s) => ({
      gameState: s.gameState
        ? { ...s.gameState, phase: 'game_end' as const, teams, winnerTeamId, playerTotals: playerTotals ?? s.gameState.playerTotals }
        : null,
      showWinner: true,
    })),

  dismissRoundResult: () => set({ showRoundResult: false }),

  showEmote: (playerId, emote) => {
    const timestamp = Date.now();
    set((s) => ({
      activeEmotes: { ...s.activeEmotes, [playerId]: { playerId, emote, timestamp } },
    }));
    // Auto-clear after 3 seconds
    setTimeout(() => {
      set((s) => {
        const current = s.activeEmotes[playerId];
        if (current && current.timestamp === timestamp) {
          const { [playerId]: _, ...rest } = s.activeEmotes;
          return { activeEmotes: rest };
        }
        return {};
      });
    }, 3000);
  },

  setTurnTimer: (endsAt) => set({ turnTimerEndsAt: endsAt }),

  reset: () => set(initialState),

  // -------------------------------------------------------------------------
  // Derived selectors
  // -------------------------------------------------------------------------

  getMyPlayer: (myPlayerId) =>
    get().gameState?.players.find((p) => p.id === myPlayerId),

  isMyTurn: (myPlayerId) =>
    get().gameState?.currentTurnPlayerId === myPlayerId,

  canIBid: (myPlayerId) => {
    const { gameState } = get();
    if (!gameState || gameState.phase !== 'bidding') return false;
    return gameState.currentTurnPlayerId === myPlayerId;
  },

  canISelectTrump: (myPlayerId) => {
    const { gameState } = get();
    if (!gameState || gameState.phase !== 'trump_selection') return false;
    return gameState.bidWinnerId === myPlayerId;
  },

  canISelectPartners: (myPlayerId) => {
    const { gameState } = get();
    if (!gameState || gameState.phase !== 'partner_selection') return false;
    return gameState.bidWinnerId === myPlayerId;
  },

  getMyTeam: (myPlayerId) => {
    const { gameState } = get();
    if (!gameState?.teams) return undefined;
    const { A, B } = gameState.teams;
    if (A.playerIds.includes(myPlayerId)) return A;
    if (B.playerIds.includes(myPlayerId)) return B;
    return undefined;
  },

  getOpponentTeam: (myPlayerId) => {
    const { gameState } = get();
    if (!gameState?.teams) return undefined;
    const { A, B } = gameState.teams;
    if (A.playerIds.includes(myPlayerId)) return B;
    if (B.playerIds.includes(myPlayerId)) return A;
    return undefined;
  },
}));
