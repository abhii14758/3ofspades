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

/** Wait for DB connection with retries — call at server startup before DB queries. */
export async function waitForDb(maxRetries = 10, delayMs = 2000): Promise<void> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      console.log(`[db] Connected (attempt ${i + 1})`);
      return;
    } catch (err: any) {
      console.log(`[db] Connection attempt ${i + 1}/${maxRetries} failed: ${err.message}`);
      if (i < maxRetries - 1) await new Promise(r => setTimeout(r, delayMs));
    }
  }
  throw new Error('Database connection failed after all retries');
}
