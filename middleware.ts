export { auth as middleware } from '@/auth';

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
