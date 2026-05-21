import type { NextAuthConfig, Session } from 'next-auth';
import type { JWT } from 'next-auth/jwt';

// Edge-compatible auth config — NO Prisma, NO bcrypt, NO Node.js built-ins.
// Used by middleware. The full auth.ts spreads this and adds Credentials provider.
export const authConfig = {
  pages: {
    signIn: '/login',
  },
  session: { strategy: 'jwt' as const },
  callbacks: {
    jwt({ token, user }: { token: JWT; user?: { id?: string } }) {
      if (user?.id) token.userId = user.id;
      return token;
    },
    session({ session, token }: { session: Session; token: JWT }) {
      if (token.userId && session.user) (session.user as { id?: string }).id = token.userId as string;
      return session;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
