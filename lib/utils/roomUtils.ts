import { v4 as uuidv4 } from 'uuid';
import type { Room, Player, RoomConfig } from '@/types';
import { defaultRoomConfig } from '@/config/gameConfig';

/** Generates a 6-character uppercase alphanumeric room code. */
export function generateRoomId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

/** Generates a UUID v4 player identifier. */
export function generatePlayerId(): string {
  return uuidv4();
}

/** Creates a new Room with the given host as the sole player. */
export function createRoom(
  roomName: string,
  host: Player,
  maxPlayers: number,
  config?: Partial<RoomConfig>,
): Room {
  return {
    id: generateRoomId(),
    name: roomName,
    hostId: host.id,
    players: [host],
    gameState: null,
    maxPlayers,
    createdAt: Date.now(),
    config: { ...defaultRoomConfig, ...(config ?? {}) },
  };
}

/** Returns true when the room has reached its maximum player count. */
export function isRoomFull(room: Room): boolean {
  return room.players.length >= room.maxPlayers;
}

/** Looks up a room by ID from a Map of rooms. */
export function getRoomById(
  rooms: Map<string, Room>,
  roomId: string,
): Room | undefined {
  return rooms.get(roomId);
}

/** Returns a new Room with the specified player removed. */
export function removePlayerFromRoom(room: Room, playerId: string): Room {
  return {
    ...room,
    players: room.players.filter((p) => p.id !== playerId),
  };
}

/** Returns only players whose status is not 'disconnected'. */
export function getActivePlayers(room: Room): Player[] {
  return room.players.filter((p) => p.status !== 'disconnected');
}
