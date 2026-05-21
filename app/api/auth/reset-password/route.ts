import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db/prisma';

export async function POST(req: NextRequest) {
  const { token, password } = await req.json();
  if (!token || !password) return NextResponse.json({ error: 'Token and password required' }, { status: 400 });
  if (password.length < 8) return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });

  const resetTokens = await prisma.passwordResetToken.findMany({
    where: { used: false, expiresAt: { gt: new Date() } },
    include: { user: true },
  });

  let matchedToken = null;
  for (const t of resetTokens) {
    const match = await bcrypt.compare(token, t.tokenHash);
    if (match) { matchedToken = t; break; }
  }

  if (!matchedToken) {
    return NextResponse.json({ error: 'Invalid or expired reset link.' }, { status: 400 });
  }

  const newHash = await bcrypt.hash(password, 12);
  await prisma.$transaction([
    prisma.user.update({ where: { id: matchedToken.userId }, data: { passwordHash: newHash } }),
    prisma.passwordResetToken.update({ where: { id: matchedToken.id }, data: { used: true } }),
  ]);

  return NextResponse.json({ ok: true });
}
