import { auth } from '@/auth';
import { prisma } from '@/lib/db/prisma';
import { NextResponse } from 'next/server';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ activeRoomId: null });
  }
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { activeRoomId: true },
  });
  return NextResponse.json({ activeRoomId: user?.activeRoomId ?? null });
}
