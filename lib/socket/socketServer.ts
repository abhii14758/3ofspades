import { Server, Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';

import type {
  Room,
  Player,
  GameState,
  Card,
  Team,
  TeamId,
  Trick,
  RoomConfig,
  CreateRoomPayload,
  JoinRoomPayload,
  PlaceBidPayload,
  SelectTrumpPayload,
  SelectPartnersPayload,
  PlayCardPayload,
  AddBotPayload,
  ReconnectPayload,
  Suit,
  VoteEndPayload,
} from '@/types';

import { gameConfig, defaultRoomConfig, getConfigForPreset } from '@/config/gameConfig';
import type { GameConfig } from '@/types';
import {
  initRound,
  startBidding,
  afterBidWon,
  afterTrumpSelected,
  afterPartnersSelected,
  processCardPlay,
  finalizeRound,
} from '@/lib/game-engine/roundEngine';
import {
  placeBid,
  isBiddingComplete,
  getBidWinner,
} from '@/lib/game-engine/bidEngine';
import {
  validateCardPlay,
  validateBidAction,
  validateTrumpSelection,
  validatePartnerSelection,
} from '@/lib/game-engine/ruleValidator';
import {
  botDecideBid,
  botSelectTrump,
  botSelectPartnerCards,
  botSelectCard,
  buildFullDeck,
} from '@/lib/game-engine/botEngine';
import { getCardTypeId } from '@/lib/game-engine/deck';

// ─── Server-side state ────────────────────────────────────────────────────────

/** All live rooms, keyed by roomId. Contains full server-side GameState (all hands). */
const rooms = new Map<string, Room>();

/** Maps socketId → { roomId, playerId } for quick disconnect lookup. */
const socketToPlayer = new Map<string, { roomId: string; playerId: string }>();

/** Pending disconnect-removal timers, keyed by playerId (60-second reconnect window). */
const disconnectTimers = new Map<string, NodeJS.Timeout>();

/** Per-room active turn timer (auto-play fires when a human doesn't act in time). */
const turnTimers = new Map<string, NodeJS.Timeout>();

/** Pending new-round start timers (3-second delay between rounds). */
const roundStartTimers = new Map<string, NodeJS.Timeout>();

/** Pending deal-animation timers — can be cancelled by game:skipDeal. */
const dealTimers = new Map<string, NodeJS.Timeout>();

/** Per-room timers that delay advancing to the next trick after a trick completes. */
const trickClearTimers = new Map<string, NodeJS.Timeout>();

/**
 * Computes how long (ms) the server waits before transitioning dealing → bidding.
 * Matches the client DealAnimation timing: DEAL_INTERVAL (0.28s) × total cards + 2s buffer.
 */
function computeDealTimeout(cfg: GameConfig): number {
  const totalCards = cfg.playerCount * cfg.cardsPerPlayer;
  return totalCards * 280 + 2000; // 6p×8c = 15440ms, 10p×9c = 27200ms
}

/** Fire dealing→bidding transition for a room (shared between startNewRound & game:start). */
function scheduleDealComplete(io: Server, roomId: string, cfg: GameConfig): void {
  // Cancel any existing deal timer for this room
  const existing = dealTimers.get(roomId);
  if (existing) { clearTimeout(existing); dealTimers.delete(roomId); }

  const timeout = computeDealTimeout(cfg);
  const t = setTimeout(() => {
    dealTimers.delete(roomId);
    const currentRoom = rooms.get(roomId);
    if (!currentRoom?.gameState) return;
    if (currentRoom.gameState.phase !== 'dealing') return;
    const biddingState = startBidding(currentRoom.gameState, cfg);
    currentRoom.gameState = biddingState;
    io.to(roomId).emit('game:dealComplete', { gameState: getSafeGameState(biddingState) });
    scheduleAutoPlayIfNeeded(io, currentRoom);
  }, timeout);
  dealTimers.set(roomId, t);
}

/**
 * Team total-point carry-over between rounds.
 * Written after finalizeRound; read when starting each new round.
 */
const roomTeamTotals = new Map<string, { A: number; B: number }>();

// ─── ID generators ────────────────────────────────────────────────────────────

function generateRoomId(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function generatePlayerId(): string {
  return uuidv4();
}

/**
 * Returns the resolved GameConfig for a specific room, based on its preset
 * and per-room turn-timer override.
 */
function getRoomConfig(room: Room): GameConfig {
  const preset = room.config.preset ?? '6p1d';
  return getConfigForPreset(preset, room.config.turnTimerSeconds);
}

// ─── State helpers ────────────────────────────────────────────────────────────

/**
 * Returns a copy of GameState safe to broadcast room-wide:
 *   - All hands stripped (clients receive their own hand via player:hand / game:stateSync).
 *   - calledCards hidden.
 *   - teams.A.playerIds shows only bid winner + publicly revealed partners.
 */
function getSafeGameState(gameState: GameState): GameState {
  return {
    ...gameState,
    hands: {},
    calledCards: [],
    teams: buildPublicTeams(gameState),
  };
}

/**
 * Returns a copy of GameState for a specific player:
 *   - hands contains ONLY that player's cards.
 *   - calledCards hidden.
 *   - teams show only the publicly revealed membership.
 */
function getPublicGameState(gameState: GameState, playerId: string): GameState {
  return {
    ...gameState,
    hands: { [playerId]: gameState.hands[playerId] ?? [] },
    // calledCards are public knowledge — everyone sees which cards are partners
    // (they just don't know WHO holds them until the card is played)
    calledCards: gameState.calledCards,
    teams: buildPublicTeams(gameState),
  };
}

/**
 * Reconstructs teams exposing only publicly known membership:
 *   team A = bid winner + any already-revealed partners
 *   team B = everyone else
 * Trick counts and points always reflect the real server-side values.
 */
function buildPublicTeams(gameState: GameState): { A: Team; B: Team } | null {
  if (!gameState.teams) return null;

  const teamAIds = [gameState.bidWinnerId, ...(gameState.revealedPartnerIds ?? [])].filter(
    (id): id is string => id !== null,
  );
  const teamBIds = gameState.players
    .map((p) => p.id)
    .filter((id) => !teamAIds.includes(id));

  return {
    A: { ...gameState.teams.A, playerIds: teamAIds },
    B: { ...gameState.teams.B, playerIds: teamBIds },
  };
}

/** Returns a Room safe to broadcast (strips hand/calledCard data from the embedded gameState). */
function getSafeRoom(room: Room): Room {
  if (!room.gameState) return room;
  return { ...room, gameState: getSafeGameState(room.gameState) };
}

/** Emits an individualised game:stateSync to every connected human player. */
function syncStateToAll(io: Server, room: Room): void {
  if (!room.gameState) return;
  for (const player of room.players) {
    if (player.socketId && player.type === 'human' && player.status !== 'disconnected') {
      io.to(player.socketId).emit('game:stateSync', {
        gameState: getPublicGameState(room.gameState, player.id),
      });
    }
  }
}

// ─── Player / seat helpers ────────────────────────────────────────────────────

function getNextSeatIndex(players: Player[], maxPlayers: number): number {
  const taken = new Set(players.map((p) => p.seatIndex));
  for (let i = 0; i < maxPlayers; i++) {
    if (!taken.has(i)) return i;
  }
  return players.length;
}

// ─── Auto-play / bot scheduling ───────────────────────────────────────────────

/**
 * Inspects the current-turn player and schedules auto-play when needed:
 *   Bot              → fires after gameConfig.botDelayMs
 *   Disconnected     → fires after 2 s
 *   Human connected  → emits countdown events; auto-plays only if player disconnects
 */
function scheduleAutoPlayIfNeeded(io: Server, room: Room): void {
  if (!room.gameState?.currentTurnPlayerId) return;

  const player = room.players.find((p) => p.id === room.gameState!.currentTurnPlayerId);
  if (!player) return;

  const roomId = room.id;
  const playerId = player.id;

  // Cancel any outstanding turn timer for this room
  const existing = turnTimers.get(roomId);
  if (existing) {
    clearInterval(existing);
    turnTimers.delete(roomId);
  }

  const isBot = player.type === 'bot';
  const isDisconnected = player.status === 'disconnected';

  const cfg = getRoomConfig(room);

  if (isBot || isDisconnected) {
    const delay = isBot ? cfg.botDelayMs : 2_000;
    setTimeout(() => {
      const currentRoom = rooms.get(roomId);
      if (!currentRoom?.gameState) return;
      if (currentRoom.gameState.currentTurnPlayerId !== playerId) return;
      executeAutoPlay(io, roomId, playerId);
    }, delay);
    return;
  }

  // Human player — emit countdown; only auto-play if they disconnect
  const timerSeconds = cfg.turnTimerSeconds;
  if (timerSeconds > 0) {
    const endsAt = Date.now() + timerSeconds * 1000;
    room.gameState.turnTimerEndsAt = endsAt;
    io.to(roomId).emit('game:turnTimerUpdate', { remainingSeconds: timerSeconds, endsAt });

    let remaining = timerSeconds;
    const interval = setInterval(() => {
      remaining--;
      if (remaining <= 0) {
        clearInterval(interval);
        turnTimers.delete(roomId);
        const currentRoom = rooms.get(roomId);
        if (!currentRoom?.gameState) return;
        if (currentRoom.gameState.currentTurnPlayerId !== playerId) return;
        currentRoom.gameState.turnTimerEndsAt = null;
        const p = currentRoom.players.find((pl) => pl.id === playerId);
        if (p?.status === 'disconnected') {
          executeAutoPlay(io, roomId, playerId);
        } else {
          io.to(roomId).emit('game:turnTimerExpired', { playerId });
        }
      } else {
        io.to(roomId).emit('game:turnTimerUpdate', { remainingSeconds: remaining });
      }
    }, 1000);
    turnTimers.set(roomId, interval as unknown as NodeJS.Timeout);
  }
}

/**
 * Performs the appropriate auto-play action for a player (bot or timed-out / disconnected human).
 */
function executeAutoPlay(io: Server, roomId: string, playerId: string): void {
  const room = rooms.get(roomId);
  if (!room?.gameState) return;

  const cfg = getRoomConfig(room);
  const gameState = room.gameState;
  const hand = gameState.hands[playerId] ?? [];

  switch (gameState.phase) {
    case 'bidding': {
      const amount = gameState.bidState
        ? botDecideBid(hand, gameState.bidState, cfg)
        : cfg.minBid;
      handlePlaceBid(io, roomId, playerId, amount);
      break;
    }
    case 'trump_selection': {
      if (playerId === gameState.bidWinnerId) {
        handleSelectTrump(io, roomId, playerId, botSelectTrump(hand, cfg));
      }
      break;
    }
    case 'partner_selection': {
      if (playerId === gameState.bidWinnerId) {
        // Build the canonical deck type IDs — independent of single/double deck suffix
        const fullDeck = buildFullDeck(cfg);
        // Pass full deck (the function handles type-ID normalization internally)
        handleSelectPartners(
          io,
          roomId,
          playerId,
          botSelectPartnerCards(hand, fullDeck, cfg),
        );
      }
      break;
    }
    case 'playing': {
      if (hand.length > 0) {
        const card = botSelectCard(hand, gameState, playerId, cfg);
        handlePlayCard(io, roomId, playerId, card.id);
      }
      break;
    }
  }
}

// ─── New round helper ─────────────────────────────────────────────────────────

function startNewRound(io: Server, roomId: string): void {
  const room = rooms.get(roomId);
  if (!room?.gameState) return;

  const cfg = getRoomConfig(room);
  const prev = room.gameState;
  const nextDealerIndex = (prev.dealerIndex + 1) % cfg.playerCount;
  const nextRoundNumber = prev.roundNumber + 1;
  const prevTotals = roomTeamTotals.get(roomId) ?? { A: 0, B: 0 };

  const newGameState = initRound(
    room.id,
    room.players,
    nextDealerIndex,
    nextRoundNumber,
    prevTotals,
    cfg,
  );
  newGameState.playerTotals = prev.playerTotals ?? {};
  newGameState.voteEndVotes = {};
  room.gameState = newGameState;

  io.to(roomId).emit('game:started', { gameState: getSafeGameState(newGameState) });

  for (const player of room.players) {
    if (player.socketId && player.type === 'human' && player.status !== 'disconnected') {
      io.to(player.socketId).emit('player:hand', {
        cards: newGameState.hands[player.id] ?? [],
      });
    }
  }

  scheduleDealComplete(io, roomId, cfg);
}

// ─── Internal action handlers ─────────────────────────────────────────────────
// Return true on success, false on validation failure.
// Called from both socket event handlers (human) and executeAutoPlay (bot / timeout).

function handlePlaceBid(
  io: Server,
  roomId: string,
  playerId: string,
  amount: number | 'pass',
): boolean {
  const room = rooms.get(roomId);
  if (!room?.gameState) return false;

  const gameState = room.gameState;
  if (gameState.phase !== 'bidding' || !gameState.bidState) return false;

  const cfg = getRoomConfig(room);
  const validation = validateBidAction(gameState, playerId, amount, cfg);
  if (!validation.valid) return false;

  const newBidState = placeBid(gameState.bidState, playerId, amount, room.players, cfg);

  if (newBidState.allPassed) {
    // All players passed with no bid placed — force dealer to bid minimum.
    // Set currentBidderId to the dealer so subsequent validation passes.
    const dealerPlayer =
      gameState.players.find((p) => p.seatIndex === gameState.dealerIndex) ??
      gameState.players[0];
    const forcedBidState = { ...newBidState, currentBidderId: dealerPlayer.id };
    room.gameState = { ...gameState, bidState: forcedBidState, currentTurnPlayerId: dealerPlayer.id };

    io.to(roomId).emit('game:bidUpdate', {
      bidState: forcedBidState,
      currentTurnPlayerId: dealerPlayer.id,
    });
    scheduleAutoPlayIfNeeded(io, room);
    return true;
  }

  if (isBiddingComplete(newBidState, room.players)) {
    const bidWinnerId = getBidWinner(newBidState)!;
    const bidAmount = newBidState.currentBid;
    const updatedState = afterBidWon(
      { ...gameState, bidState: newBidState },
      bidWinnerId,
      bidAmount,
      cfg,
    );
    room.gameState = updatedState;

    io.to(roomId).emit('game:bidUpdate', {
      bidState: updatedState.bidState!,
      currentTurnPlayerId: bidWinnerId,
    });
    syncStateToAll(io, room);
  } else {
    room.gameState = {
      ...gameState,
      bidState: newBidState,
      currentTurnPlayerId: newBidState.currentBidderId!,
    };

    io.to(roomId).emit('game:bidUpdate', {
      bidState: newBidState,
      currentTurnPlayerId: newBidState.currentBidderId!,
    });
  }

  scheduleAutoPlayIfNeeded(io, room);
  return true;
}

function handleSelectTrump(
  io: Server,
  roomId: string,
  playerId: string,
  suit: Suit,
): boolean {
  const room = rooms.get(roomId);
  if (!room?.gameState) return false;

  const validation = validateTrumpSelection(room.gameState, playerId, suit);
  if (!validation.valid) return false;

  const newGameState = afterTrumpSelected(room.gameState, suit);
  room.gameState = newGameState;

  io.to(roomId).emit('game:trumpSelected', {
    trumpSuit: suit,
    currentTurnPlayerId: playerId,
  });

  const bidWinner = room.players.find((p) => p.id === playerId);
  if (bidWinner?.socketId && bidWinner.type === 'human' && bidWinner.status !== 'disconnected') {
    io.to(bidWinner.socketId).emit('game:partnerSelectionNeeded', {});
  }

  syncStateToAll(io, room);
  scheduleAutoPlayIfNeeded(io, room);
  return true;
}

function handleSelectPartners(
  io: Server,
  roomId: string,
  playerId: string,
  cardIds: string[],
): boolean {
  const room = rooms.get(roomId);
  if (!room?.gameState) return false;

  const gameState = room.gameState;

  const cfg = getRoomConfig(room);
  const validation = validatePartnerSelection(gameState, playerId, cardIds, cfg);
  if (!validation.valid) return false;

  // Check bidder doesn't hold all copies of any selected typeId
  const bidWinnerHand = gameState.hands[playerId] ?? [];
  const deckCount = cfg.deckCount ?? 1;
  const handTypeCounts: Record<string, number> = {};
  for (const c of bidWinnerHand) {
    const t = getCardTypeId(c);
    handTypeCounts[t] = (handTypeCounts[t] ?? 0) + 1;
  }
  // Count selection occurrences per typeId
  const selectionCounts: Record<string, number> = {};
  for (const typeId of cardIds) {
    selectionCounts[typeId] = (selectionCounts[typeId] ?? 0) + 1;
  }
  // Reject if fewer copies exist outside the bidder's hand than slots requested
  for (const [typeId, selectCount] of Object.entries(selectionCounts)) {
    const heldCount = handTypeCounts[typeId] ?? 0;
    if (heldCount + selectCount > deckCount) return false;
  }

  // Verify enough distinct non-bidder players hold each selected typeId
  const partnerSlots: Record<string, number> = {};
  for (const typeId of cardIds) {
    partnerSlots[typeId] = (partnerSlots[typeId] ?? 0) + 1;
  }
  for (const [typeId, slotsNeeded] of Object.entries(partnerSlots)) {
    const holders = Object.entries(gameState.hands)
      .filter(([pid, hand]) =>
        pid !== playerId && hand.some((c) => getCardTypeId(c) === typeId)
      ).length;
    if (holders < slotsNeeded) return false;
  }

  // afterPartnersSelected handles team setup, phase transition, and first-trick init
  const newGameState = afterPartnersSelected(gameState, cardIds);
  room.gameState = newGameState;

  // Persist team totals for next round carry-over
  if (newGameState.teams) {
    roomTeamTotals.set(roomId, {
      A: newGameState.teams.A.totalPoints,
      B: newGameState.teams.B.totalPoints,
    });
  }

  // Send called cards privately to bid winner only
  const bidWinnerPlayer = room.players.find((p) => p.id === playerId);
  if (
    bidWinnerPlayer?.socketId &&
    bidWinnerPlayer.type === 'human' &&
    bidWinnerPlayer.status !== 'disconnected'
  ) {
    io.to(bidWinnerPlayer.socketId).emit('player:calledCards', { cards: newGameState.calledCards });
  }

  syncStateToAll(io, room);
  scheduleAutoPlayIfNeeded(io, room);
  return true;
}

function handlePlayCard(
  io: Server,
  roomId: string,
  playerId: string,
  cardId: string,
): boolean {
  const room = rooms.get(roomId);
  if (!room?.gameState) return false;

  const gameState = room.gameState;
  if (gameState.phase !== 'playing') return false;
  if (gameState.currentTurnPlayerId !== playerId) return false;

  const hand = gameState.hands[playerId] ?? [];
  const card = hand.find((c) => c.id === cardId);
  if (!card) return false;

  const cfg = getRoomConfig(room);
  const validation = validateCardPlay(gameState, playerId, cardId, cfg);
  if (!validation.valid) return false;

  const { newState, trickComplete, partnerRevealed, revealedPartnerId } = processCardPlay(
    gameState,
    playerId,
    card,
    cfg,
  );

  room.gameState = newState;

  // Partner reveal announcement
  if (partnerRevealed && revealedPartnerId) {
    const partnerPlayer = newState.players.find((p) => p.id === revealedPartnerId);
    io.to(roomId).emit('game:partnerRevealed', {
      playerId: revealedPartnerId,
      card,
      partnerName: partnerPlayer?.name ?? 'Unknown',
    });
  }

  // For game:cardPlayed, use the resolved trick (in completedTricks) when trick just finished,
  // or the in-progress trick otherwise
  const trickForEvent = trickComplete
    ? newState.completedTricks[newState.completedTricks.length - 1]
    : newState.currentTrick!;

  io.to(roomId).emit('game:cardPlayed', { playerId, card, trick: trickForEvent });

  if (trickComplete) {
    const completedTrick = newState.completedTricks[newState.completedTricks.length - 1];
    const winnerId = completedTrick.winnerId!;
    const allTricksDone = newState.completedTricks.length >= cfg.totalTricks;

    io.to(roomId).emit('game:trickComplete', {
      trick: completedTrick,
      winnerId,
      nextTurnPlayerId: allTricksDone ? '' : winnerId,
      teams: buildPublicTeams(newState) ?? newState.teams,
    });

    if (allTricksDone) {
      const finalState = finalizeRound(newState, cfg);
      room.gameState = finalState;

      // Per-player score deltas for this round
      const prevPlayerTotals: Record<string, number> = newState.playerTotals ?? {};
      const updatedPlayerTotals: Record<string, number> = { ...prevPlayerTotals };
      const lastHistory = finalState.roundHistory[finalState.roundHistory.length - 1];

      if (lastHistory && finalState.teams) {
        const bidTeamIsA = finalState.teams.A.playerIds.includes(finalState.bidWinnerId ?? '');
        const bidTeamId: TeamId = bidTeamIsA ? 'A' : 'B';
        const otherTeamId: TeamId = bidTeamIsA ? 'B' : 'A';

        for (const player of finalState.players) {
          const onBidTeam = finalState.teams[bidTeamId].playerIds.includes(player.id);
          const delta = lastHistory.bidMade
            ? (onBidTeam
                ? finalState.teams[bidTeamId].roundPoints
                : finalState.teams[otherTeamId].roundPoints)
            : (onBidTeam
                ? -lastHistory.bidAmount
                : finalState.teams[otherTeamId].roundPoints + lastHistory.bidAmount);
          updatedPlayerTotals[player.id] = (prevPlayerTotals[player.id] ?? 0) + delta;
        }
      }

      finalState.playerTotals = updatedPlayerTotals;

      const lastIdx = finalState.roundHistory.length - 1;
      if (lastIdx >= 0) {
        const playerRoundDeltas: Record<string, number> = {};
        for (const player of finalState.players) {
          playerRoundDeltas[player.id] =
            (updatedPlayerTotals[player.id] ?? 0) - (prevPlayerTotals[player.id] ?? 0);
        }
        finalState.roundHistory[lastIdx] = {
          ...finalState.roundHistory[lastIdx],
          playerRoundDeltas,
        };
      }

      roomTeamTotals.set(roomId, {
        A: finalState.teams?.A.totalPoints ?? 0,
        B: finalState.teams?.B.totalPoints ?? 0,
      });

      io.to(roomId).emit('game:roundEnd', {
        roundHistory: lastHistory,
        teams: finalState.teams,
        winnerTeamId: finalState.winnerTeamId ?? null,
        playerTotals: updatedPlayerTotals,
      });

      if (finalState.winnerTeamId) {
        io.to(roomId).emit('game:end', {
          winnerTeamId: finalState.winnerTeamId,
          teams: finalState.teams,
          roundHistory: finalState.roundHistory,
          playerTotals: updatedPlayerTotals,
        });
      }
      // No auto-restart: host must emit game:nextRound to begin the next round
    } else {
      // Cancel any pending trick-clear timer for this room
      const existingClear = trickClearTimers.get(roomId);
      if (existingClear) { clearTimeout(existingClear); trickClearTimers.delete(roomId); }

      // Show completed trick for 5s before advancing to next trick
      const trickClearDelay = 5000;
      const clearTimer = setTimeout(() => {
        trickClearTimers.delete(roomId);
        const currentRoom = rooms.get(roomId);
        if (!currentRoom?.gameState) return;
        syncStateToAll(io, currentRoom);
        scheduleAutoPlayIfNeeded(io, currentRoom);
      }, trickClearDelay);
      trickClearTimers.set(roomId, clearTimer);
    }
  } else {
    syncStateToAll(io, room);
    scheduleAutoPlayIfNeeded(io, room);
  }

  return true;
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Attaches all game socket event handlers to the provided Socket.IO server instance.
 * Called once from server.ts during application startup.
 */
export function setupSocketServer(io: Server): void {
  io.on('connection', (socket: Socket) => {
    // ── room:create ───────────────────────────────────────────────────────
    socket.on('room:create', (payload: CreateRoomPayload) => {
      const roomId = generateRoomId();
      const playerId = generatePlayerId();

      const player: Player = {
        id: playerId,
        name: payload.playerName.trim() || 'Player 1',
        type: 'human',
        status: 'waiting',
        isHost: true,
        seatIndex: 0,
        socketId: socket.id,
      };

      const config: RoomConfig = { ...defaultRoomConfig, ...(payload.config ?? {}) };
      // Ensure preset defaults are set
      if (!config.preset) config.preset = '6p1d';

      const preset = getConfigForPreset(config.preset);

      const room: Room = {
        id: roomId,
        name: payload.roomName.trim() || `${payload.playerName}'s Room`,
        hostId: playerId,
        players: [player],
        gameState: null,
        maxPlayers: preset.playerCount,
        createdAt: Date.now(),
        config,
      };

      rooms.set(roomId, room);
      socketToPlayer.set(socket.id, { roomId, playerId });
      socket.join(roomId);

      socket.emit('room:created', { room: getSafeRoom(room), playerId });
    });

    // ── room:join ─────────────────────────────────────────────────────────
    socket.on('room:join', (payload: JoinRoomPayload) => {
      const room = rooms.get(payload.roomId);

      if (!room) {
        socket.emit('room:error', { message: 'Room not found' });
        return;
      }
      if (room.players.length >= room.maxPlayers) {
        socket.emit('room:error', { message: 'Room is full' });
        return;
      }
      if (room.gameState) {
        socket.emit('room:error', { message: 'Game already in progress' });
        return;
      }

      const playerId = generatePlayerId();
      const player: Player = {
        id: playerId,
        name: payload.playerName.trim() || `Player ${room.players.length + 1}`,
        type: 'human',
        status: 'waiting',
        isHost: false,
        seatIndex: getNextSeatIndex(room.players, room.maxPlayers),
        socketId: socket.id,
      };

      room.players.push(player);
      socketToPlayer.set(socket.id, { roomId: payload.roomId, playerId });
      socket.join(payload.roomId);

      socket.emit('room:joined', { room: getSafeRoom(room), playerId });
      socket.to(payload.roomId).emit('room:updated', { room: getSafeRoom(room) });
    });

    // ── room:ready ────────────────────────────────────────────────────────
    socket.on('room:ready', (payload: { roomId: string }) => {
      const info = socketToPlayer.get(socket.id);
      if (!info) return;

      const room = rooms.get(payload.roomId);
      if (!room) return;

      const player = room.players.find((p) => p.id === info.playerId);
      if (!player || room.gameState) return;

      player.status = player.status === 'ready' ? 'waiting' : 'ready';
      io.to(payload.roomId).emit('room:updated', { room: getSafeRoom(room) });
    });

    // ── room:addBot ───────────────────────────────────────────────────────
    socket.on('room:addBot', (payload: AddBotPayload) => {
      const info = socketToPlayer.get(socket.id);
      if (!info) return;

      const room = rooms.get(payload.roomId);
      if (!room) return;

      if (info.playerId !== room.hostId) {
        socket.emit('room:error', { message: 'Only the host can add bots' });
        return;
      }
      if (room.gameState) {
        socket.emit('room:error', { message: 'Cannot add bots during a game' });
        return;
      }
      if (room.players.length >= room.maxPlayers) {
        socket.emit('room:error', { message: 'Room is full' });
        return;
      }
      const botCount = room.players.filter((p) => p.type === 'bot').length;
      if (botCount >= room.maxPlayers - 1) {
        socket.emit('room:error', { message: `Maximum ${room.maxPlayers - 1} bots allowed` });
        return;
      }

      const bot: Player = {
        id: generatePlayerId(),
        name: `Bot ${botCount + 1}`,
        type: 'bot',
        status: 'ready',
        isHost: false,
        seatIndex: getNextSeatIndex(room.players, room.maxPlayers),
      };

      room.players.push(bot);
      io.to(payload.roomId).emit('room:updated', { room: getSafeRoom(room) });
    });

    // ── room:kickPlayer ───────────────────────────────────────────────────
    socket.on('room:kickPlayer', (payload: { roomId: string; targetPlayerId: string }) => {
      const info = socketToPlayer.get(socket.id);
      if (!info) return;

      const room = rooms.get(payload.roomId);
      if (!room) return;

      if (info.playerId !== room.hostId) {
        socket.emit('room:error', { message: 'Only the host can remove players' });
        return;
      }
      if (room.gameState) {
        socket.emit('room:error', { message: 'Cannot remove players during a game' });
        return;
      }
      if (payload.targetPlayerId === room.hostId) {
        socket.emit('room:error', { message: 'Host cannot kick themselves' });
        return;
      }

      const targetPlayer = room.players.find((p) => p.id === payload.targetPlayerId);
      if (!targetPlayer) {
        socket.emit('room:error', { message: 'Player not found' });
        return;
      }

      // Cancel any pending disconnect timer for this player
      const existingTimer = disconnectTimers.get(payload.targetPlayerId);
      if (existingTimer) {
        clearTimeout(existingTimer);
        disconnectTimers.delete(payload.targetPlayerId);
      }

      // Remove from room
      room.players = room.players.filter((p) => p.id !== payload.targetPlayerId);

      // Notify the kicked player
      if (targetPlayer.socketId) {
        io.to(targetPlayer.socketId).emit('room:kicked', {
          reason: 'You were removed from the room by the host',
        });
        // Remove their socket→player mapping
        for (const [sid, info] of socketToPlayer.entries()) {
          if (info.playerId === payload.targetPlayerId) {
            socketToPlayer.delete(sid);
            break;
          }
        }
      }

      // Notify everyone else
      io.to(payload.roomId).emit('room:updated', { room: getSafeRoom(room) });
    });

    // ── game:start ────────────────────────────────────────────────────────
    socket.on('game:start', (payload: { roomId: string }) => {
      const info = socketToPlayer.get(socket.id);
      if (!info) return;

      const room = rooms.get(payload.roomId);
      if (!room) return;

      if (info.playerId !== room.hostId) {
        socket.emit('room:error', { message: 'Only the host can start the game' });
        return;
      }

      const cfg = getRoomConfig(room);

      if (room.players.length !== cfg.playerCount) {
        socket.emit('room:error', {
          message: `Need exactly ${cfg.playerCount} players to start`,
        });
        return;
      }

      const humanPlayers = room.players.filter((p) => p.type === 'human');
      if (!humanPlayers.every((p) => p.status === 'ready' || p.isHost)) {
        socket.emit('room:error', { message: 'All players must be ready' });
        return;
      }

      const gameState = initRound(room.id, room.players, 0, 1, null, cfg);
      gameState.playerTotals = {};
      gameState.voteEndVotes = {};
      room.gameState = gameState;

      io.to(payload.roomId).emit('game:started', { gameState: getSafeGameState(gameState) });

      for (const player of room.players) {
        if (player.socketId && player.type === 'human' && player.status !== 'disconnected') {
          io.to(player.socketId).emit('player:hand', {
            cards: gameState.hands[player.id] ?? [],
          });
        }
      }

      // Transition dealing → bidding after the deal animation
      scheduleDealComplete(io, payload.roomId, cfg);
    });

    // ── game:skipDeal — host skips the deal animation early ───────────────
    socket.on('game:skipDeal', (payload: { roomId: string }) => {
      const info = socketToPlayer.get(socket.id);
      if (!info) return;
      const room = rooms.get(payload.roomId);
      if (!room) return;
      // Only the host may skip
      if (info.playerId !== room.hostId) return;
      if (!room.gameState || room.gameState.phase !== 'dealing') return;

      // Cancel pending deal timer
      const pending = dealTimers.get(payload.roomId);
      if (pending) { clearTimeout(pending); dealTimers.delete(payload.roomId); }

      const cfg = getRoomConfig(room);
      const biddingState = startBidding(room.gameState, cfg);
      room.gameState = biddingState;
      io.to(payload.roomId).emit('game:dealComplete', { gameState: getSafeGameState(biddingState) });
      scheduleAutoPlayIfNeeded(io, room);
    });

    // ── game:placeBid ─────────────────────────────────────────────────────
    socket.on('game:placeBid', (payload: PlaceBidPayload) => {
      const info = socketToPlayer.get(socket.id);
      if (!info || info.roomId !== payload.roomId) {
        socket.emit('room:error', { message: 'Invalid room' });
        return;
      }
      if (!handlePlaceBid(io, payload.roomId, info.playerId, payload.amount)) {
        socket.emit('room:error', { message: 'Invalid bid' });
      }
    });

    // ── game:selectTrump ──────────────────────────────────────────────────
    socket.on('game:selectTrump', (payload: SelectTrumpPayload) => {
      const info = socketToPlayer.get(socket.id);
      if (!info || info.roomId !== payload.roomId) {
        socket.emit('room:error', { message: 'Invalid room' });
        return;
      }
      if (!handleSelectTrump(io, payload.roomId, info.playerId, payload.suit)) {
        socket.emit('room:error', { message: 'Cannot select trump now' });
      }
    });

    // ── game:selectPartners ───────────────────────────────────────────────
    socket.on('game:selectPartners', (payload: SelectPartnersPayload) => {
      const info = socketToPlayer.get(socket.id);
      if (!info || info.roomId !== payload.roomId) {
        socket.emit('room:error', { message: 'Invalid room' });
        return;
      }
      if (!handleSelectPartners(io, payload.roomId, info.playerId, payload.cardIds)) {
        socket.emit('room:error', { message: 'Invalid partner selection' });
      }
    });

    // ── game:playCard ─────────────────────────────────────────────────────
    socket.on('game:playCard', (payload: PlayCardPayload) => {
      const info = socketToPlayer.get(socket.id);
      if (!info || info.roomId !== payload.roomId) {
        socket.emit('room:error', { message: 'Invalid room' });
        return;
      }
      if (!handlePlayCard(io, payload.roomId, info.playerId, payload.cardId)) {
        socket.emit('room:error', { message: 'Invalid card play' });
      }
    });

    // ── game:nextRound ────────────────────────────────────────────────────
    socket.on('game:nextRound', (payload: { roomId: string }) => {
      const info = socketToPlayer.get(socket.id);
      if (!info || info.roomId !== payload.roomId) return;

      const room = rooms.get(payload.roomId);
      if (!room) return;

      if (info.playerId !== room.hostId) {
        socket.emit('room:error', { message: 'Only the host can start the next round' });
        return;
      }
      if (!room.gameState || room.gameState.phase !== 'round_end') {
        socket.emit('room:error', { message: 'Round has not ended yet' });
        return;
      }

      startNewRound(io, payload.roomId);
    });

    // ── game:playAgain ─────────────────────────────────────────────────────
    // Host-only. Allowed from game_end phase. Keeps room + playerTotals.
    // Resets team totals (fresh game) but playerTotals carry forward.
    // Note: startNewRound() already does `newGameState.playerTotals = prev.playerTotals`
    // so per-player scores are preserved automatically.
    socket.on('game:playAgain', (payload: { roomId: string }) => {
      const info = socketToPlayer.get(socket.id);
      if (!info || info.roomId !== payload.roomId) return;

      const room = rooms.get(payload.roomId);
      if (!room) return;

      if (info.playerId !== room.hostId) {
        socket.emit('room:error', { message: 'Only the host can start a new game' });
        return;
      }
      if (!room.gameState || room.gameState.phase !== 'game_end') {
        socket.emit('room:error', { message: 'Game has not ended yet' });
        return;
      }

      // Reset team totals so new game starts teams from 0
      // (per-player totals carry forward via startNewRound's existing logic)
      roomTeamTotals.set(payload.roomId, { A: 0, B: 0 });

      startNewRound(io, payload.roomId);
    });

    // ── game:voteEnd ──────────────────────────────────────────────────────
    socket.on('game:voteEnd', (payload: VoteEndPayload) => {
      const info = socketToPlayer.get(socket.id);
      if (!info) return;
      const { roomId, playerId } = info;
      const room = rooms.get(roomId);
      if (!room?.gameState) return;
      if (room.gameState.phase === 'lobby' || room.gameState.phase === 'dealing') return;

      // Record vote
      if (!room.gameState.voteEndVotes) room.gameState.voteEndVotes = {};
      room.gameState.voteEndVotes[playerId] = true;

      const totalPlayers = room.players.filter((p) => p.status !== 'disconnected').length;
      const yesVotes = Object.values(room.gameState.voteEndVotes).filter(Boolean).length;
      const percentage = totalPlayers > 0 ? yesVotes / totalPlayers : 0;

      io.to(roomId).emit('game:voteEndUpdate', {
        votes: room.gameState.voteEndVotes,
        yesCount: yesVotes,
        totalCount: totalPlayers,
        percentage,
      });

      if (percentage >= 0.8) {
        io.to(roomId).emit('game:terminated', { reason: 'vote', roomId });
        room.gameState = null;
      }
    });

    // ── game:terminate ────────────────────────────────────────────────────
    socket.on('game:terminate', (payload: { roomId: string }) => {
      const info = socketToPlayer.get(socket.id);
      if (!info || info.roomId !== payload.roomId) return;

      const room = rooms.get(payload.roomId);
      if (!room) return;

      if (info.playerId !== room.hostId) {
        socket.emit('room:error', { message: 'Only the host can terminate the game' });
        return;
      }

      // Clear pending timers
      const turnTimer = turnTimers.get(payload.roomId);
      if (turnTimer) {
        clearInterval(turnTimer);
        turnTimers.delete(payload.roomId);
      }
      const roundTimer = roundStartTimers.get(payload.roomId);
      if (roundTimer) {
        clearTimeout(roundTimer);
        roundStartTimers.delete(payload.roomId);
      }

      io.to(payload.roomId).emit('game:terminated', { message: 'Game terminated by host' });
      rooms.delete(payload.roomId);
    });

    // ── player:setAvatar ─────────────────────────────────────────────────
    socket.on('player:setAvatar', ({ roomId, avatarUrl }: { roomId: string; avatarUrl: string }) => {
      const info = socketToPlayer.get(socket.id);
      if (!info || info.roomId !== roomId) return;
      const room = rooms.get(roomId);
      if (!room) return;
      // Limit to 200KB to prevent abuse
      if (avatarUrl.length > 200_000) {
        socket.emit('room:error', { message: 'Avatar image too large (max 150KB)' });
        return;
      }
      const player = room.players.find(p => p.id === info.playerId);
      if (player) {
        player.avatarUrl = avatarUrl;
        io.to(roomId).emit('room:playerUpdate', {
          players: room.players.map(p => ({ ...p, socketId: undefined })),
        });
      }
    });

    // ── player:reconnect ──────────────────────────────────────────────────
    socket.on('player:reconnect', (payload: ReconnectPayload) => {
      const { roomId, playerId } = payload;
      const room = rooms.get(roomId);

      if (!room) {
        socket.emit('room:error', { message: 'Room not found' });
        return;
      }
      const player = room.players.find((p) => p.id === playerId);
      if (!player) {
        socket.emit('room:error', { message: 'Player not found in room' });
        return;
      }

      // Cancel pending removal timer
      const existingTimer = disconnectTimers.get(playerId);
      if (existingTimer) {
        clearTimeout(existingTimer);
        disconnectTimers.delete(playerId);
      }

      // Re-map socket
      if (player.socketId) socketToPlayer.delete(player.socketId);
      player.socketId = socket.id;
      player.status = room.gameState ? 'playing' : 'ready';
      socketToPlayer.set(socket.id, { roomId, playerId });
      socket.join(roomId);

      io.to(roomId).emit('room:updated', { room: getSafeRoom(room) });

      if (room.gameState) {
        socket.emit('game:stateSync', {
          gameState: getPublicGameState(room.gameState, playerId),
        });
        socket.emit('player:hand', { cards: room.gameState.hands[playerId] ?? [] });

        // Re-send called cards if this player is the bid winner and already selected partners
        if (playerId === room.gameState.bidWinnerId && room.gameState.calledCards.length > 0) {
          socket.emit('player:calledCards', { cards: room.gameState.calledCards });
        }
      }
    });

    // ── disconnect ────────────────────────────────────────────────────────
    socket.on('disconnect', () => {
      const info = socketToPlayer.get(socket.id);
      if (!info) return;

      const { roomId, playerId } = info;
      socketToPlayer.delete(socket.id);

      const room = rooms.get(roomId);
      if (!room) return;

      const player = room.players.find((p) => p.id === playerId);
      if (!player) return;

      player.status = 'disconnected';
      io.to(roomId).emit('room:updated', { room: getSafeRoom(room) });

      // If it's this player's turn, trigger auto-play immediately
      if (room.gameState?.currentTurnPlayerId === playerId) {
        scheduleAutoPlayIfNeeded(io, room);
      }

      // 60-second window for reconnection before permanent removal
      const timer = setTimeout(() => {
        disconnectTimers.delete(playerId);

        const currentRoom = rooms.get(roomId);
        if (!currentRoom) return;

        const idx = currentRoom.players.findIndex((p) => p.id === playerId);
        if (idx === -1) return;

        if (currentRoom.gameState) {
          // Game running — drop their hand; other players continue
          delete currentRoom.gameState.hands[playerId];
          currentRoom.players.splice(idx, 1);
        } else {
          // Lobby — if host left, close the room entirely
          if (currentRoom.hostId === playerId) {
            rooms.delete(roomId);
            io.to(roomId).emit('room:closed', { reason: 'Host has left the room' });
            return;
          }

          currentRoom.players.splice(idx, 1);

          if (currentRoom.players.length === 0) {
            rooms.delete(roomId);
            return;
          }
        }

        if (rooms.has(roomId)) {
          io.to(roomId).emit('room:updated', { room: getSafeRoom(currentRoom) });
        }
      }, 60_000);

      disconnectTimers.set(playerId, timer);
    });

    // ── chat:send ────────────────────────────────────────────────────────
    socket.on('chat:send', ({ roomId, text }: { roomId: string; text: string }) => {
      const info = socketToPlayer.get(socket.id);
      if (!info || info.roomId !== roomId) return;
      const room = rooms.get(roomId);
      if (!room) return;
      const player = room.players.find(p => p.id === info.playerId);
      if (!player) return;
      const text_clean = String(text).trim().slice(0, 200);
      if (!text_clean) return;
      const msg = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        playerId: info.playerId,
        playerName: player.name,
        text: text_clean,
        timestamp: Date.now(),
      };
      io.to(roomId).emit('chat:receive', msg);
    });
  });
}

// Alias for any callers using the longer name
export { setupSocketServer as initSocketServer };
