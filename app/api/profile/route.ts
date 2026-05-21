import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db/prisma';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { stats: true },
  });
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    bio: user.bio,
    avatarUrl: user.avatarUrl,
    avatarType: user.avatarType,
    presetAvatarId: user.presetAvatarId,
    equippedFrameId: user.equippedFrameId,
    createdAt: user.createdAt,
    stats: user.stats ?? {
      gamesPlayed: 0,
      gamesWon: 0,
      totalPoints: 0,
      totalTricks: 0,
      winStreak: 0,
      maxWinStreak: 0,
    },
  });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { displayName, bio, presetAvatarId, avatarType, avatarUrl } = body;

  const data: Record<string, string> = {};
  if (displayName !== undefined) {
    if (displayName.trim().length < 2) return NextResponse.json({ error: 'Name too short' }, { status: 400 });
    if (displayName.trim().length > 20) return NextResponse.json({ error: 'Name too long' }, { status: 400 });
    data.displayName = displayName.trim();
  }
  if (bio !== undefined) data.bio = bio.slice(0, 160);
  if (presetAvatarId !== undefined) data.presetAvatarId = presetAvatarId;
  if (avatarType !== undefined) data.avatarType = avatarType;
  if (avatarUrl !== undefined) data.avatarUrl = avatarUrl;

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data,
  });

  return NextResponse.json({
    displayName: user.displayName,
    bio: user.bio,
    presetAvatarId: user.presetAvatarId,
  });
}
