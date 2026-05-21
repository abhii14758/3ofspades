import NextAuth from 'next-auth';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { authConfig } from './auth.config';

const { auth } = NextAuth(authConfig);

const PROTECTED_PATHS = ['/lobby', '/room', '/game', '/profile', '/leaderboard'];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'));

  if (!isProtected) return NextResponse.next();

  const session = await auth();
  if (!session?.user) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/lobby',
    '/lobby/:path*',
    '/room/:path*',
    '/game/:path*',
    '/profile',
    '/profile/:path*',
    '/leaderboard',
  ],
};
