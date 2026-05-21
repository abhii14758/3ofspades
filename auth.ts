import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db/prisma';
import { authConfig } from './auth.config';
import type { Session } from 'next-auth';
import type { JWT } from 'next-auth/jwt';

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      authorize: async (credentials) => {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        });

        if (!user) return null;

        const valid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        );
        if (!valid) return null;

        if (user.activeRoomId) {
          throw new Error('ACCOUNT_IN_GAME');
        }

        return {
          id: user.id,
          email: user.email,
          name: user.displayName,
          image: user.avatarUrl || null,
          activeRoomId: user.activeRoomId,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }: { token: JWT; user?: { id?: string; activeRoomId?: string | null } }) {
      if (user?.id) {
        token.userId = user.id;
        token.activeRoomId = user.activeRoomId ?? null;
      }
      return token;
    },
    session({ session, token }: { session: Session; token: JWT }) {
      if (token.userId && session.user) {
        (session.user as { id?: string; activeRoomId?: string | null }).id = token.userId as string;
        (session.user as { id?: string; activeRoomId?: string | null }).activeRoomId = (token.activeRoomId as string | null) ?? null;
      }
      return session;
    },
  },
});
