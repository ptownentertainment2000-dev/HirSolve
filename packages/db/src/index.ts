import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export const db = prisma;

export async function checkDatabaseHealth(): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Database unavailable' };
  }
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
}

export * from '@prisma/client';
