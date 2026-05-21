import { Server, Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '@/lib/db/prisma';

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
  CalledCardSlot,
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

let userIdToSocketMap: Map<string, string>;

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

/** Tracks which playerIds pressed ESC (blackout) per room — reset on reveal. */
const blackoutVoters = new Map<string, Set<string>>();

/**
 * Computes how long (ms) the server waits before transitioning dealing → bidding.
 * Mirrors client DealAnimation: ROUND_INTERVAL(500ms) × cardsPerPlayer rounds + buffer.
 * 6p 1-deck: 8×500+2720=6720ms, 6p 2-deck: 16×500+2720=10720ms, 8p 2-deck: 12×500+2720=8720ms
 */
function computeDealTimeout(cfg: GameConfig): number {
  return cfg.cardsPerPlayer * 500 + 2720;
}

/** Fire dealing→bidding transition for a room (shared between startNewRound & game:start). */
function scheduleDealComplete(io: Server, roomId: string, cfg: GameConfig): void {
  // Cancel any existing deal timer for this room
  const existing = dealTimers.get(roomId);
  if (existing) { clearTimeout(existing); dealTimers.delete(roomId); }

  const timeout = computeDealTimeout(cfg);
  const t = setTimeout(() => {
    dealTimers.delete(roomId);
    try {
      const currentRoom = rooms.get(roomId);
      if (!currentRoom?.gameState) return;
      if (currentRoom.gameState.phase !== 'dealing') return;
      const biddingState = startBidding(currentRoom.gameState, cfg);
      currentRoom.gameState = biddingState;
      io.to(roomId).emit('game:dealComplete', { gameState: getSafeGameState(biddingState) });
      scheduleAutoPlayIfNeeded(io, currentRoom);
    } catch (err) {
      console.error('[dealTimer]', err);
    }
  }, timeout);
  dealTimers.set(roomId, t);
}

/**
 * Team total-point carry-over between rounds.
 * Written after finalizeRound; read when starting each new round.
 */
const roomTeamTotals = new Map<string, { A: number; B: number }>();

/** Cancel and delete ALL timers associated with a room. Call before rooms.delete(). */
function cleanupRoomTimers(roomId: string): void {
  const turn = turnTimers.get(roomId);
  if (turn) { clearInterval(turn); turnTimers.delete(roomId); }

  const round = roundStartTimers.get(roomId);
  if (round) { clearTimeout(round); roundStartTimers.delete(roomId); }

  const deal = dealTimers.get(roomId);
  if (deal) { clearTimeout(deal); dealTimers.delete(roomId); }

  const trickClear = trickClearTimers.get(roomId);
  if (trickClear) { clearTimeout(trickClear); trickClearTimers.delete(roomId); }

  roomTeamTotals.delete(roomId);
  blackoutVoters.delete(roomId);
}

// ─── ID generators ────────────────────────────────────────────────────────────

function generateRoomId(): string {
  let id: string;
  let attempts = 0;
  do {
    id = Math.random().toString(36).substring(2, 8).toUpperCase();
    if (++attempts > 100) throw new Error('Could not generate unique room ID after 100 attempts');
  } while (rooms.has(id));
  return id;
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
    const t = setTimeout(() => {
      turnTimers.delete(roomId);
      try {
        const currentRoom = rooms.get(roomId);
        if (!currentRoom?.gameState) return;
        if (currentRoom.gameState.currentTurnPlayerId !== playerId) return;
        // Re-check: if player has reconnected as human, let them play themselves
        const currentPlayer = currentRoom.players.find((pl) => pl.id === playerId);
        if (!currentPlayer || (currentPlayer.type !== 'bot' && currentPlayer.status !== 'disconnected')) return;
        executeAutoPlay(io, roomId, playerId);
      } catch (err) {
        console.error(`[autoPlay] roomId=${roomId} playerId=${playerId}`, err);
      }
    }, delay);
    turnTimers.set(roomId, t);
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
      try {
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
      } catch (err) {
        console.error('[turnTimer]', err);
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
  slots: Array<{ typeId: string; ordinal: 1 | 2 }>,
): boolean {
  const room = rooms.get(roomId);
  if (!room?.gameState) return false;

  const gameState = room.gameState;

  const cfg = getRoomConfig(room);

  // Validate using typeIds
  const typeIds = slots.map(s => s.typeId);
  const validation = validatePartnerSelection(gameState, playerId, typeIds, cfg);
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
  for (const slot of slots) {
    selectionCounts[slot.typeId] = (selectionCounts[slot.typeId] ?? 0) + 1;
  }
  // Reject if fewer copies exist outside the bidder's hand than slots requested
  for (const [typeId, selectCount] of Object.entries(selectionCounts)) {
    const heldCount = handTypeCounts[typeId] ?? 0;
    if (heldCount + selectCount > deckCount) return false;
  }

  // Convert to CalledCardSlot[]
  const calledCardSlots: CalledCardSlot[] = slots.map((s) => ({
    typeId: s.typeId,
    ordinal: s.ordinal,
    assignedPartnerId: null,
    isVoid: false,
  }));

  const newGameState = afterPartnersSelected(gameState, calledCardSlots);
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
    io.to(bidWinnerPlayer.socketId).emit('player:calledCards', {
      cards: newGameState.calledCards,
      slots: newGameState.calledCardSlots,
    });
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
      calledCardSlots: newState.calledCardSlots,
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
        // Clear activeRoomId for all human players now that game is over
        const humanPlayers = room.players.filter(p => p.type === 'human' || p.isSubstitutedBot);
        Promise.all(humanPlayers.map(p =>
          prisma.user.update({ where: { id: p.id }, data: { activeRoomId: null } }).catch(console.error)
        ));
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
        try {
          const currentRoom = rooms.get(roomId);
          if (!currentRoom?.gameState) return;
          syncStateToAll(io, currentRoom);
          scheduleAutoPlayIfNeeded(io, currentRoom);
        } catch (err) {
          console.error('[trickClearTimer]', err);
        }
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
export function setupSocketServer(io: Server, userIdToSocket?: Map<string, string>): void {
  userIdToSocketMap = userIdToSocket ?? new Map();
  // On startup, clear all activeRoomId values — server restart wipes in-memory
  // game state, so any DB-tracked "active room" is now stale.
  prisma.user.updateMany({ data: { activeRoomId: null } })
    .then(r => { if (r.count > 0) console.log(`[socket] Cleared stale activeRoomId for ${r.count} user(s)`); })
    .catch(err => console.error('[socket] Failed to clear stale activeRoomIds:', err));

  io.on('connection', (socket: Socket) => {
    // ── room:create ───────────────────────────────────────────────────────
    socket.on('room:create', (payload: CreateRoomPayload) => {
      try {
        const roomId = generateRoomId();
        const playerId = socket.data.userId ?? generatePlayerId();

      const player: Player = {
        id: playerId,
        name: payload.playerName.trim() || 'Player 1',
        type: 'human',
        status: 'waiting',
        isHost: true,
        seatIndex: 0,
        socketId: socket.id,
        avatarType: payload.avatarType ?? 'preset',
        presetAvatarId: payload.presetAvatarId ?? 'spade',
        avatarUrl: payload.avatarUrl ?? '',
        equippedFrameId: payload.equippedFrameId ?? 'none',
        equippedCardBackId: payload.equippedCardBackId ?? 'default',
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

      if (userIdToSocketMap && socket.data.userId) {
        userIdToSocketMap.set(socket.data.userId, socket.id);
      }

      if (socket.data.userId) {
        prisma.user.update({ where: { id: socket.data.userId }, data: { activeRoomId: roomId } })
          .catch(err => console.error('[socket] Failed to set activeRoomId:', err));
      }

      socket.emit('room:created', { room: getSafeRoom(room), playerId });
      } catch (err) {
        console.error('[room:create]', err);
        socket.emit('room:error', { message: 'Server error processing action' });
      }
    });

    // ── room:join ─────────────────────────────────────────────────────────
    socket.on('room:join', (payload: JoinRoomPayload) => {
      const room = rooms.get(payload.roomId);

      if (!room) {
        socket.emit('room:error', { message: 'Room not found' });
        // Clear stale activeRoomId so the client stops redirecting here
        if (socket.data.userId) {
          prisma.user.update({ where: { id: socket.data.userId }, data: { activeRoomId: null } })
            .catch(err => console.error('[socket] Failed to clear stale activeRoomId:', err));
        }
        return;
      }
      if (room.players.length >= room.maxPlayers) {
        socket.emit('room:error', { message: 'Room is full' });
        return;
      }

      const playerId = socket.data.userId ?? generatePlayerId();

      // Reconnect path: same authenticated user reconnecting to their seat
      if (socket.data.userId) {
        const existingPlayer = room.players.find(p => p.id === socket.data.userId);
        if (existingPlayer) {
          // Player is already in room — reconnect them (lobby or game in progress)
          const existingTimer = disconnectTimers.get(existingPlayer.id);
          if (existingTimer) { clearTimeout(existingTimer); disconnectTimers.delete(existingPlayer.id); }
          if (existingPlayer.socketId) socketToPlayer.delete(existingPlayer.socketId);
          existingPlayer.socketId = socket.id;
          existingPlayer.status = room.gameState ? 'playing' : 'ready';
          if (existingPlayer.isSubstitutedBot) { existingPlayer.type = 'human'; existingPlayer.isSubstitutedBot = false; }
          socketToPlayer.set(socket.id, { roomId: payload.roomId, playerId: existingPlayer.id });
          socket.join(payload.roomId);

          if (userIdToSocketMap) userIdToSocketMap.set(existingPlayer.id, socket.id);

          prisma.user.update({ where: { id: socket.data.userId }, data: { activeRoomId: payload.roomId } })
            .catch(err => console.error('[socket] Failed to set activeRoomId on reconnect:', err));

          socket.emit('room:joined', { room: getSafeRoom(room), playerId: existingPlayer.id });
          socket.to(payload.roomId).emit('room:updated', { room: getSafeRoom(room) });

          if (room.gameState) {
            const gs = room.gameState as GameState;
            socket.emit('game:stateSync', { gameState: getPublicGameState(gs, existingPlayer.id) });
            socket.emit('player:hand', { cards: gs.hands[existingPlayer.id] ?? [] });
            if (existingPlayer.id === gs.bidWinnerId && gs.calledCards.length > 0) {
              socket.emit('player:calledCards', { cards: gs.calledCards, slots: gs.calledCardSlots ?? [] });
            }
            if (gs.currentTurnPlayerId === existingPlayer.id) {
              scheduleAutoPlayIfNeeded(io, room);
            }
          }
          return;
        }
      }

      // Block new joins if game is already running (reconnects handled above)
      if (room.gameState) {
        socket.emit('room:error', { message: 'Game already in progress' });
        return;
      }

      // New player joining
      const player: Player = {
        id: playerId,
        name: payload.playerName.trim() || `Player ${room.players.length + 1}`,
        type: 'human',
        status: 'waiting',
        isHost: false,
        seatIndex: getNextSeatIndex(room.players, room.maxPlayers),
        socketId: socket.id,
        avatarType: payload.avatarType ?? 'preset',
        presetAvatarId: payload.presetAvatarId ?? 'spade',
        avatarUrl: payload.avatarUrl ?? '',
        equippedFrameId: payload.equippedFrameId ?? 'none',
        equippedCardBackId: payload.equippedCardBackId ?? 'default',
      };

      room.players.push(player);
      socketToPlayer.set(socket.id, { roomId: payload.roomId, playerId });
      socket.join(payload.roomId);

      if (userIdToSocketMap && socket.data.userId) {
        userIdToSocketMap.set(socket.data.userId, socket.id);
      }

      if (socket.data.userId) {
        prisma.user.update({ where: { id: socket.data.userId }, data: { activeRoomId: payload.roomId } })
          .catch(err => console.error('[socket] Failed to set activeRoomId on join:', err));
      }

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

      // Clear activeRoomId for kicked player
      prisma.user.update({ where: { id: payload.targetPlayerId }, data: { activeRoomId: null } })
        .catch(err => console.error('[socket] Failed to clear activeRoomId on kick:', err));

      // Notify the kicked player before modifying their state
      if (targetPlayer.socketId) {
        io.to(targetPlayer.socketId).emit('room:kicked', {
          reason: 'You were removed from the room by the host',
        });
        for (const [sid, sInfo] of socketToPlayer.entries()) {
          if (sInfo.playerId === payload.targetPlayerId) {
            socketToPlayer.delete(sid);
            break;
          }
        }
      }

      if (room.gameState) {
        // Game in progress — convert to substituted bot so game never stalls
        targetPlayer.type = 'bot';
        targetPlayer.isSubstitutedBot = true;
        targetPlayer.status = 'playing';
        targetPlayer.socketId = undefined;
        // If it's their turn, schedule bot play immediately
        if (room.gameState.currentTurnPlayerId === payload.targetPlayerId) {
          scheduleAutoPlayIfNeeded(io, room);
        }
        io.to(payload.roomId).emit('game:stateUpdate', { gameState: getSafeGameState(room.gameState) });
      } else {
        // Lobby — fully remove
        room.players = room.players.filter((p) => p.id !== payload.targetPlayerId);
        io.to(payload.roomId).emit('room:updated', { room: getSafeRoom(room) });
      }
    });

    // ── game:start ────────────────────────────────────────────────────────
    socket.on('game:start', (payload: { roomId: string }) => {
      try {
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
      } catch (err) {
        console.error('[game:start]', err);
        socket.emit('room:error', { message: 'Server error processing action' });
      }
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
      try {
        const info = socketToPlayer.get(socket.id);
        if (!info || info.roomId !== payload.roomId) {
          socket.emit('room:error', { message: 'Invalid room' });
          return;
        }
        if (!handlePlaceBid(io, payload.roomId, info.playerId, payload.amount)) {
          socket.emit('room:error', { message: 'Invalid bid' });
        }
      } catch (err) {
        console.error('[game:placeBid]', err);
        socket.emit('room:error', { message: 'Server error processing action' });
      }
    });

    // ── game:selectTrump ──────────────────────────────────────────────────
    socket.on('game:selectTrump', (payload: SelectTrumpPayload) => {
      try {
        const info = socketToPlayer.get(socket.id);
        if (!info || info.roomId !== payload.roomId) {
          socket.emit('room:error', { message: 'Invalid room' });
          return;
        }
        if (!handleSelectTrump(io, payload.roomId, info.playerId, payload.suit)) {
          socket.emit('room:error', { message: 'Cannot select trump now' });
        }
      } catch (err) {
        console.error('[game:selectTrump]', err);
        socket.emit('room:error', { message: 'Server error processing action' });
      }
    });

    // ── game:selectPartners ───────────────────────────────────────────────
    socket.on('game:selectPartners', (payload: SelectPartnersPayload) => {
      try {
        const info = socketToPlayer.get(socket.id);
        if (!info || info.roomId !== payload.roomId) {
          socket.emit('room:error', { message: 'Invalid room' });
          return;
        }
        const slots = payload.cardSlots ?? (payload.cardIds?.map(id => ({ typeId: id, ordinal: 1 as const })) ?? []);
        if (!handleSelectPartners(io, payload.roomId, info.playerId, slots)) {
          socket.emit('room:error', { message: 'Invalid partner selection' });
        }
      } catch (err) {
        console.error('[game:selectPartners]', err);
        socket.emit('room:error', { message: 'Server error processing action' });
      }
    });

    // ── game:playCard ─────────────────────────────────────────────────────
    socket.on('game:playCard', (payload: PlayCardPayload) => {
      try {
        const info = socketToPlayer.get(socket.id);
        if (!info || info.roomId !== payload.roomId) {
          socket.emit('room:error', { message: 'Invalid room' });
          return;
        }
        if (!handlePlayCard(io, payload.roomId, info.playerId, payload.cardId)) {
          socket.emit('room:error', { message: 'Invalid card play' });
        }
      } catch (err) {
        console.error('[game:playCard]', err);
        socket.emit('room:error', { message: 'Server error processing action' });
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

      const totalPlayers = room.players.filter((p) => p.type === 'human' && p.status !== 'disconnected').length;
      const yesVotes = Object.values(room.gameState.voteEndVotes).filter(Boolean).length;
      const percentage = totalPlayers > 0 ? yesVotes / totalPlayers : 0;

      io.to(roomId).emit('game:voteEndUpdate', {
        votes: room.gameState.voteEndVotes,
        yesCount: yesVotes,
        totalCount: totalPlayers,
        percentage,
      });

      if (percentage >= 0.8) {
        cleanupRoomTimers(roomId);
        io.to(roomId).emit('game:terminated', { reason: 'vote', roomId });
        // Reset to lobby state
        room.gameState = null;
        room.players.forEach(p => { p.status = 'waiting'; });
        io.to(roomId).emit('room:updated', { room: getSafeRoom(room) });
      }
    });

    // ── game:terminate ────────────────────────────────────────────────────
    socket.on('game:terminate', (payload: { roomId: string }) => {
      try {
        const info = socketToPlayer.get(socket.id);
        if (!info) return;
        const room = rooms.get(payload.roomId);
        if (!room) return;
        const player = room.players.find((p) => p.id === info.playerId);
        if (!player?.isHost) return;
        cleanupRoomTimers(payload.roomId);
        io.to(payload.roomId).emit('game:terminated', { message: 'Game terminated by host' });
        rooms.delete(payload.roomId);
      } catch (err) {
        console.error('[game:terminate]', err);
      }
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
      try {
        const { roomId, playerId } = payload;

        // Security: authenticated users can only reconnect as themselves
        if (socket.data.userId && socket.data.userId !== playerId) {
          socket.emit('room:error', { message: 'Cannot reconnect as a different player' });
          return;
        }

        const room = rooms.get(roomId);

      if (!room) {
        socket.emit('room:error', { message: 'Room not found' });
        // Clear stale activeRoomId so the client stops redirecting here
        if (socket.data.userId) {
          prisma.user.update({ where: { id: socket.data.userId }, data: { activeRoomId: null } })
            .catch(err => console.error('[socket] Failed to clear stale activeRoomId:', err));
        }
        return;
      }
      let player = room.players.find((p) => p.id === playerId);

      // Fallback: if player was created with a random UUID (before login),
      // they may be reconnecting with their userId now. Find any disconnected
      // human player in the room — if only one exists, assume it's them.
      if (!player && socket.data.userId) {
        const disconnectedHumans = room.players.filter(
          (p) => (p.type === 'bot' && p.isSubstitutedBot) || (p.type === 'human' && p.status === 'disconnected'),
        );
        if (disconnectedHumans.length === 1) {
          player = disconnectedHumans[0];
        }
      }

      if (!player) {
        socket.emit('room:error', { message: 'Player not found in room' });
        return;
      }

      // Use the actual player ID (may differ from payload if fallback matched)
      const actualPlayerId = player.id;

      // Cancel pending removal timer
      const existingTimer = disconnectTimers.get(actualPlayerId);
      if (existingTimer) {
        clearTimeout(existingTimer);
        disconnectTimers.delete(actualPlayerId);
      }

      // Re-map socket
      if (player.socketId) socketToPlayer.delete(player.socketId);
      player.socketId = socket.id;
      socket.data.userId = actualPlayerId;
      // Revert substituted bot back to human
      if (player.isSubstitutedBot) {
        player.type = 'human';
        player.isSubstitutedBot = false;
      }
      player.status = room.gameState ? 'playing' : 'ready';
      socketToPlayer.set(socket.id, { roomId, playerId: actualPlayerId });
      socket.join(roomId);

      if (userIdToSocketMap) {
        userIdToSocketMap.set(actualPlayerId, socket.id);
      }

      io.to(roomId).emit('room:updated', { room: getSafeRoom(room) });

      if (room.gameState) {
        socket.emit('game:stateSync', {
          gameState: getPublicGameState(room.gameState, actualPlayerId),
        });
        socket.emit('player:hand', { cards: room.gameState.hands[actualPlayerId] ?? [] });

        // Re-send called cards if this player is the bid winner and already selected partners
        if (actualPlayerId === room.gameState.bidWinnerId && room.gameState.calledCards.length > 0) {
          socket.emit('player:calledCards', {
            cards: room.gameState.calledCards,
            slots: room.gameState.calledCardSlots ?? [],
          });
        }

        // If it's this player's turn, reset the turn timer from bot-mode to human-mode
        if (room.gameState.currentTurnPlayerId === actualPlayerId) {
          scheduleAutoPlayIfNeeded(io, room);
        }
      }

      // Notify client of their actual player ID (in case it differs from what they sent)
      if (actualPlayerId !== playerId) {
        socket.emit('player:idUpdate', { playerId: actualPlayerId });
      }
      } catch (err) {
        console.error('[player:reconnect]', err);
        socket.emit('room:error', { message: 'Server error processing action' });
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
      player.socketId = undefined;

      if (room.gameState) {
        // Game is running — immediately substitute with bot so game never stalls.
        // Keep status='disconnected' so the UI shows the greyed-out indicator.
        // The player can still reconnect within 60 s and reclaim their seat.
        player.type = 'bot';
        player.isSubstitutedBot = true;
        io.to(roomId).emit('room:updated', { room: getSafeRoom(room) });
        // If it's their turn right now, schedule the bot play immediately.
        if (room.gameState.currentTurnPlayerId === playerId) {
          scheduleAutoPlayIfNeeded(io, room);
        }
      } else {
        io.to(roomId).emit('room:updated', { room: getSafeRoom(room) });
      }

      // 60-second window for reconnection before permanent removal / confirmation
      const timer = setTimeout(() => {
        disconnectTimers.delete(playerId);
        try {
          const currentRoom = rooms.get(roomId);
          if (!currentRoom) return;

          const idx = currentRoom.players.findIndex((p) => p.id === playerId);
          if (idx === -1) return;

          // Player timed out — clear their activeRoomId (bot has permanently taken over)
          prisma.user.update({ where: { id: playerId }, data: { activeRoomId: null } })
            .catch(err => console.error('[socket] Failed to clear activeRoomId on bot takeover:', err));

          if (currentRoom.gameState) {
            // Substitution is now permanent — update status to 'playing' so
            // the UI no longer shows the player as disconnected.
            currentRoom.players[idx].status = 'playing';
            // If it happens to be their turn right now, ensure bot plays.
            if (currentRoom.gameState.currentTurnPlayerId === currentRoom.players[idx].id) {
              scheduleAutoPlayIfNeeded(io, currentRoom);
            }
            // Transfer host if the disconnected player was the host
            if (currentRoom.hostId === playerId) {
              const nextHost = currentRoom.players.find(
                (p) => p.id !== playerId && p.type === 'human' && p.status === 'playing'
              );
              if (nextHost) {
                currentRoom.hostId = nextHost.id;
                nextHost.isHost = true;
                currentRoom.players[idx].isHost = false;
                io.to(roomId).emit('room:hostTransferred', { newHostId: nextHost.id, newHostName: nextHost.name });
              }
            }
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
        } catch (err) {
          console.error('[disconnectTimer]', err);
        }
      }, 60_000);

      disconnectTimers.set(playerId, timer);
    });

    // ── room:leave ────────────────────────────────────────────────────────
    socket.on('room:leave', ({ roomId }: { roomId: string }) => {
      try {
        const info = socketToPlayer.get(socket.id);
        if (!info || info.roomId !== roomId) return;
        const { playerId } = info;
        const room = rooms.get(roomId);
        if (!room) return;

        // Cancel any pending disconnect timer
        const existingTimer = disconnectTimers.get(playerId);
        if (existingTimer) {
          clearTimeout(existingTimer);
          disconnectTimers.delete(playerId);
        }

        const player = room.players.find((p) => p.id === playerId);
        if (!player) return;

        socketToPlayer.delete(socket.id);
        socket.leave(roomId);

        if (socket.data.userId) {
          prisma.user.update({ where: { id: socket.data.userId }, data: { activeRoomId: null } })
            .catch(err => console.error('[socket] Failed to clear activeRoomId on leave:', err));
        }

        if (room.gameState && room.gameState.phase !== 'game_end') {
          // Active game running — substitute with bot immediately
          player.type = 'bot';
          player.isSubstitutedBot = true;
          player.status = 'playing';
          player.socketId = undefined;
          if (room.gameState.currentTurnPlayerId === playerId) {
            scheduleAutoPlayIfNeeded(io, room);
          }
          io.to(roomId).emit('room:updated', { room: getSafeRoom(room) });
          syncStateToAll(io, room);
        } else {
          // Lobby or game_end — remove them; if host, close the room
          if (room.hostId === playerId) {
            rooms.delete(roomId);
            io.to(roomId).emit('room:closed', { reason: 'Host has left the room' });
            return;
          }
          const idx = room.players.findIndex((p) => p.id === playerId);
          if (idx !== -1) room.players.splice(idx, 1);
          if (room.players.length === 0) {
            rooms.delete(roomId);
            return;
          }
          io.to(roomId).emit('room:updated', { room: getSafeRoom(room) });
        }

        socket.emit('room:left', {});
      } catch (err) {
        console.error('[room:leave]', err);
        socket.emit('room:error', { message: 'Server error processing action' });
      }
    });

    // ── player:rename ─────────────────────────────────────────────────────
    socket.on('player:rename', ({ roomId, name }: { roomId: string; name: string }) => {
      const info = socketToPlayer.get(socket.id);
      if (!info || info.roomId !== roomId) return;
      const room = rooms.get(roomId);
      if (!room) return;
      const player = room.players.find((p) => p.id === info.playerId);
      if (!player) return;
      const newName = String(name).trim().slice(0, 20);
      if (!newName) return;
      player.name = newName;
      if (room.gameState) {
        const gsPlayer = room.gameState.players.find((p) => p.id === info.playerId);
        if (gsPlayer) gsPlayer.name = newName;
        syncStateToAll(io, room);
      }
      io.to(roomId).emit('room:updated', { room: getSafeRoom(room) });
    });

    // ── room:updateConfig ─────────────────────────────────────────────────
    socket.on('room:updateConfig', ({ roomId, config }: { roomId: string; config: Partial<RoomConfig> }) => {
      const info = socketToPlayer.get(socket.id);
      if (!info || info.roomId !== roomId) return;
      const room = rooms.get(roomId);
      if (!room) return;
      // Only host, only in lobby
      if (info.playerId !== room.hostId || room.gameState) return;
      room.config = { ...room.config, ...config };
      if (config.preset) {
        const newCfg = getConfigForPreset(config.preset);
        room.maxPlayers = newCfg.playerCount;
        // Remove excess players/bots (trim from the end)
        while (room.players.length > room.maxPlayers) {
          const removed = room.players.pop();
          if (removed?.socketId) socketToPlayer.delete(removed.socketId);
        }
      }
      io.to(roomId).emit('room:updated', { room: getSafeRoom(room) });
    });

    // ── room:blackout ─────────────────────────────────────────────────────
    socket.on('room:blackout', ({ roomId }: { roomId: string }) => {
      const info = socketToPlayer.get(socket.id);
      if (!info || info.roomId !== roomId) return;
      const room = rooms.get(roomId);
      if (!room) return;

      // Track who pressed ESC
      if (!blackoutVoters.has(roomId)) blackoutVoters.set(roomId, new Set());
      blackoutVoters.get(roomId)!.add(info.playerId);

      // Broadcast blackout to everyone
      io.to(roomId).emit('room:blackout');

      // Send count+names to the host
      const voters = blackoutVoters.get(roomId)!;
      const names = [...voters].map(pid => room.players.find(p => p.id === pid)?.name ?? pid);
      const hostPlayer = room.players.find(p => p.id === room.hostId);
      if (hostPlayer?.socketId) {
        io.to(hostPlayer.socketId).emit('room:blackoutCount', { count: voters.size, names });
      }
    });

    // ── room:blackoutReveal ───────────────────────────────────────────────
    socket.on('room:blackoutReveal', ({ roomId }: { roomId: string }) => {
      const info = socketToPlayer.get(socket.id);
      if (!info || info.roomId !== roomId) return;
      const room = rooms.get(roomId);
      if (!room) return;

      // Clear voter tracking on reveal
      blackoutVoters.delete(roomId);
      io.to(roomId).emit('room:blackoutReveal');
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
