-- CreateTable
CREATE TABLE "RoomDB" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hostId" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "maxPlayers" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'lobby',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoomDB_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerRecord" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'human',
    "status" TEXT NOT NULL DEFAULT 'waiting',
    "isHost" BOOLEAN NOT NULL DEFAULT false,
    "seatIndex" INTEGER NOT NULL DEFAULT 0,
    "avatarType" TEXT NOT NULL DEFAULT 'preset',
    "presetAvatarId" TEXT NOT NULL DEFAULT 'spade',
    "avatarUrl" TEXT NOT NULL DEFAULT '',
    "equippedFrameId" TEXT NOT NULL DEFAULT 'none',
    "equippedCardBackId" TEXT NOT NULL DEFAULT 'default',
    "isSubstitutedBot" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PlayerRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameStateDB" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "phase" TEXT NOT NULL,
    "roundNumber" INTEGER NOT NULL DEFAULT 1,
    "dealerIndex" INTEGER NOT NULL DEFAULT 0,
    "currentTurnPlayerId" TEXT,
    "bidWinnerId" TEXT,
    "trumpSuit" TEXT,
    "hands" JSONB NOT NULL DEFAULT '{}',
    "bidState" JSONB,
    "currentTrick" JSONB,
    "calledCards" JSONB NOT NULL DEFAULT '[]',
    "calledCardSlots" JSONB NOT NULL DEFAULT '[]',
    "revealedPartnerIds" JSONB NOT NULL DEFAULT '[]',
    "teams" JSONB,
    "roundHistory" JSONB NOT NULL DEFAULT '[]',
    "completedTricks" JSONB NOT NULL DEFAULT '[]',
    "playerTotals" JSONB NOT NULL DEFAULT '{}',
    "voteEndVotes" JSONB NOT NULL DEFAULT '{}',
    "turnTimerEndsAt" DOUBLE PRECISION,
    "winnerTeamId" TEXT,
    "players" JSONB NOT NULL DEFAULT '[]',
    "partnerCards" JSONB NOT NULL DEFAULT '[]',
    "partnerIds" JSONB NOT NULL DEFAULT '[]',
    "playTypeCounters" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "GameStateDB_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GameStateDB_roomId_key" ON "GameStateDB"("roomId");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerRecord_id_roomId_key" ON "PlayerRecord"("id", "roomId");

-- AddForeignKey
ALTER TABLE "PlayerRecord" ADD CONSTRAINT "PlayerRecord_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "RoomDB"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameStateDB" ADD CONSTRAINT "GameStateDB_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "RoomDB"("id") ON DELETE CASCADE ON UPDATE CASCADE;
