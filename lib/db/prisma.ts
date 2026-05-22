import { PrismaClient } from '@/lib/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function createPrismaClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

/** Wait for DB connection with retries using a raw TCP check. */
export async function waitForDb(maxRetries = 15, delayMs = 2000): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');

  for (let i = 0; i < maxRetries; i++) {
    try {
      await prisma.user.findFirst({ select: { id: true }, take: 1 });
      console.log(`[db] Connected (attempt ${i + 1})`);
      return;
    } catch (err: any) {
      console.log(`[db] Attempt ${i + 1}/${maxRetries} failed: ${err.message}`);
      if (i < maxRetries - 1) await new Promise(r => setTimeout(r, delayMs));
    }
  }
  console.error('[db] All connection attempts failed — starting without DB');
}
