import { prisma } from '@/lib/db/prisma';
import type { Room, GameState, Player } from '@/types';

// ─── Serialize: in-memory → DB ──────────────────────────────────────────────

function playerToRecord(player: Player, roomId: string) {
  return {
    id: player.id,
    roomId,
    name: player.name,
    type: player.type,
    status: player.status,
    isHost: player.isHost,
    seatIndex: player.seatIndex,
    avatarType: player.avatarType ?? 'preset',
    presetAvatarId: player.presetAvatarId ?? 'spade',
    avatarUrl: player.avatarUrl ?? '',
    equippedFrameId: player.equippedFrameId ?? 'none',
    equippedCardBackId: player.equippedCardBackId ?? 'default',
    isSubstitutedBot: player.isSubstitutedBot ?? false,
  };
}

function gameStateToDB(gameState: GameState, roomId: string) {
  return {
    roomId,
    phase: gameState.phase,
    roundNumber: gameState.roundNumber,
    dealerIndex: gameState.dealerIndex,
    currentTurnPlayerId: gameState.currentTurnPlayerId,
    bidWinnerId: gameState.bidWinnerId,
    trumpSuit: gameState.trumpSuit,
    hands: gameState.hands as any,
    bidState: gameState.bidState ?? undefined,
    currentTrick: gameState.currentTrick ?? undefined,
    calledCards: gameState.calledCards as any,
    calledCardSlots: gameState.calledCardSlots as any,
    revealedPartnerIds: gameState.revealedPartnerIds as any,
    teams: gameState.teams ?? undefined,
    roundHistory: gameState.roundHistory as any,
    completedTricks: gameState.completedTricks as any,
    playerTotals: gameState.playerTotals ?? {},
    voteEndVotes: gameState.voteEndVotes ?? {},
    turnTimerEndsAt: gameState.turnTimerEndsAt,
    winnerTeamId: gameState.winnerTeamId,
    players: gameState.players as any,
    partnerCards: gameState.partnerCards as any,
    partnerIds: gameState.partnerIds as any,
    playTypeCounters: gameState.playTypeCounters ?? {},
  };
}

// ─── Persist: write room to DB ──────────────────────────────────────────────

export async function persistRoom(room: Room): Promise<void> {
  const playerRecords = room.players.map(p => playerToRecord(p, room.id));

  const roomData = {
    id: room.id,
    name: room.name,
    hostId: room.hostId,
    config: room.config as any,
    maxPlayers: room.maxPlayers,
    status: room.gameState?.phase ?? 'lobby',
    players: { deleteMany: {}, create: playerRecords },
  };

  if (room.gameState) {
    const gsData = gameStateToDB(room.gameState, room.id) as any;
    await prisma.roomDB.upsert({
      where: { id: room.id },
      update: {
        ...roomData,
        gameState: { upsert: { create: gsData, update: gsData } },
      },
      create: {
        ...roomData,
        gameState: { create: gsData },
      },
    });
  } else {
    await prisma.roomDB.upsert({
      where: { id: room.id },
      update: { ...roomData, gameState: { delete: true } },
      create: { ...roomData },
    });
  }
}

// ─── Persist game state only (lighter write for frequent updates) ────────────

export async function persistGameState(room: Room): Promise<void> {
  if (!room.gameState) return;
  const gsData = gameStateToDB(room.gameState, room.id) as any;

  await prisma.gameStateDB.upsert({
    where: { roomId: room.id },
    update: gsData,
    create: gsData,
  });

  // Also update room status
  await prisma.roomDB.update({
    where: { id: room.id },
    data: { status: room.gameState.phase },
  });
}

// ─── Delete room from DB ────────────────────────────────────────────────────

export async function deleteRoom(roomId: string): Promise<void> {
  await prisma.roomDB.delete({ where: { id: roomId } }).catch(() => {});
}

// ─── Deserialize: DB → in-memory ────────────────────────────────────────────

export async function loadRoomFromDB(roomId: string): Promise<Room | null> {
  const dbRoom = await prisma.roomDB.findUnique({
    where: { id: roomId },
    include: { players: true, gameState: true },
  });

  if (!dbRoom) return null;

  const players: Player[] = dbRoom.players.map(pr => ({
    id: pr.id,
    name: pr.name,
    type: pr.type as Player['type'],
    status: pr.status as Player['status'],
    isHost: pr.isHost,
    seatIndex: pr.seatIndex,
    socketId: undefined,
    avatarType: pr.avatarType as 'preset' | 'upload',
    presetAvatarId: pr.presetAvatarId,
    avatarUrl: pr.avatarUrl,
    equippedFrameId: pr.equippedFrameId,
    equippedCardBackId: pr.equippedCardBackId,
    isSubstitutedBot: pr.isSubstitutedBot,
  }));

  let gameState: GameState | null = null;
  if (dbRoom.gameState) {
    const gs = dbRoom.gameState;
    gameState = {
      roomId: gs.roomId,
      phase: gs.phase as GameState['phase'],
      roundNumber: gs.roundNumber,
      players: gs.players as unknown as Player[],
      hands: gs.hands as unknown as Record<string, import('@/types').Card[]>,
      currentTrick: gs.currentTrick as unknown as GameState['currentTrick'],
      completedTricks: gs.completedTricks as unknown as GameState['completedTricks'],
      bidState: gs.bidState as unknown as GameState['bidState'],
      trumpSuit: gs.trumpSuit as unknown as GameState['trumpSuit'],
      partnerCards: gs.partnerCards as unknown as GameState['partnerCards'],
      calledCards: gs.calledCards as unknown as GameState['calledCards'],
      bidWinnerId: gs.bidWinnerId,
      partnerIds: gs.partnerIds as unknown as string[],
      revealedPartnerIds: gs.revealedPartnerIds as unknown as string[],
      calledCardSlots: gs.calledCardSlots as unknown as GameState['calledCardSlots'],
      playTypeCounters: gs.playTypeCounters as unknown as Record<string, number>,
      teams: gs.teams as unknown as GameState['teams'],
      dealerIndex: gs.dealerIndex,
      currentTurnPlayerId: gs.currentTurnPlayerId,
      turnTimerEndsAt: gs.turnTimerEndsAt,
      roundHistory: gs.roundHistory as unknown as GameState['roundHistory'],
      winnerTeamId: gs.winnerTeamId as unknown as GameState['winnerTeamId'],
      voteEndVotes: gs.voteEndVotes as unknown as Record<string, boolean>,
      playerTotals: gs.playerTotals as unknown as Record<string, number>,
    };
  }

  return {
    id: dbRoom.id,
    name: dbRoom.name,
    hostId: dbRoom.hostId,
    players,
    gameState,
    maxPlayers: dbRoom.maxPlayers,
    createdAt: dbRoom.createdAt.getTime(),
    config: dbRoom.config as unknown as import('@/types').RoomConfig,
  };
}

// ─── Load all active rooms (for restart recovery) ──────────────────────────

export async function loadAllActiveRooms(): Promise<Room[]> {
  const activeStatuses = ['lobby', 'dealing', 'bidding', 'trump_selection', 'partner_selection', 'playing', 'round_end'];
  const dbRooms = await prisma.roomDB.findMany({
    where: { status: { in: activeStatuses } },
    include: { players: true, gameState: true },
  });

  const rooms: Room[] = [];
  for (const dbRoom of dbRooms) {
    const room = await loadRoomFromDB(dbRoom.id);
    if (room) {
      // Set all human players to disconnected so they'll reconnect
      for (const player of room.players) {
        if (player.type === 'human') {
          player.status = 'disconnected';
          player.socketId = undefined;
        }
      }
      rooms.push(room);
    }
  }

  return rooms;
}

// ─── Debounced persistence ──────────────────────────────────────────────────

const pendingPersists = new Map<string, NodeJS.Timeout>();

const PERSIST_INTERVAL_MS = 3000;

/** Schedule a debounced persist for a room. Call after every game action. */
export function schedulePersist(roomId: string, rooms: Map<string, Room>): void {
  const existing = pendingPersists.get(roomId);
  if (existing) return; // Already scheduled

  const timer = setTimeout(async () => {
    pendingPersists.delete(roomId);
    const room = rooms.get(roomId);
    if (!room) return;
    try {
      await persistGameState(room);
    } catch (err) {
      console.error(`[persist] Failed for room ${roomId}:`, err);
    }
  }, PERSIST_INTERVAL_MS);

  pendingPersists.set(roomId, timer);
}

/** Cancel a pending persist (e.g., room was deleted). */
export function cancelPersist(roomId: string): void {
  const timer = pendingPersists.get(roomId);
  if (timer) {
    clearTimeout(timer);
    pendingPersists.delete(roomId);
  }
}

/** Immediately persist all pending rooms (for graceful shutdown). */
export async function flushAllPending(rooms: Map<string, Room>): Promise<void> {
  for (const [roomId, timer] of pendingPersists) {
    clearTimeout(timer);
    pendingPersists.delete(roomId);
  }
  const promises: Promise<void>[] = [];
  for (const [roomId, room] of rooms) {
    promises.push(persistRoom(room).catch(err => console.error(`[flush] Room ${roomId}:`, err)));
  }
  await Promise.all(promises);
}

// ─── Cleanup old rooms ─────────────────────────────────────────────────────

/** Delete rooms that have been in game_end for over 30 minutes. */
export async function cleanupOldRooms(): Promise<number> {
  const cutoff = new Date(Date.now() - 30 * 60 * 1000);
  const result = await prisma.roomDB.deleteMany({
    where: {
      status: 'game_end',
      updatedAt: { lt: cutoff },
    },
  });
  return result.count;
}
