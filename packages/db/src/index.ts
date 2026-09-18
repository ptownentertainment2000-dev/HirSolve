import { PrismaClient } from '@prisma/client';
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
export const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
export const db = prisma;
export async function checkDatabaseHealth() { try { await prisma.$queryRaw`SELECT 1`; return { ok: true as const }; } catch (error) { return { ok: false as const, error: error instanceof Error ? error.message : 'Database unavailable' }; } }
export async function disconnectDatabase() { await prisma.$disconnect(); }
export * from '@prisma/client';
