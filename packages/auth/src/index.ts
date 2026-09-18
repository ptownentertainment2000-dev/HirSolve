import argon2 from 'argon2';
import { createHash, randomBytes } from 'node:crypto';
import { prisma, type Role, type User } from '@hirsolve/db';

export type AuthSession = {
  id: string;
  userId: string;
  email: string;
  roles: Role[];
  expiresAt: Date;
};

export class AuthError extends Error {
  constructor(message = 'Invalid credentials') {
    super(message);
    this.name = 'AuthError';
  }
}

export async function hashPassword(password: string): Promise<string> {
  if (password.length < 12) throw new AuthError('Password must be at least 12 characters');
  return argon2.hash(password, { type: argon2.argon2id });
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

export function generateSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function createSession(user: Pick<User, 'id' | 'email'> & { roles: { role: Role }[] }, options?: { ipAddress?: string; userAgent?: string; ttlMs?: number }) {
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + (options?.ttlMs ?? 1000 * 60 * 60 * 24 * 30));
  const session = await prisma.session.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt,
      ipAddress: options?.ipAddress,
      userAgent: options?.userAgent,
    },
  });
  return { token, session: { id: session.id, userId: user.id, email: user.email, roles: user.roles.map(({ role }) => role), expiresAt } } satisfies { token: string; session: AuthSession };
}

export async function getSession(token: string): Promise<AuthSession | null> {
  const session = await prisma.session.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: { include: { roles: true } } } });
  if (!session || session.revokedAt || session.expiresAt <= new Date() || session.user.status !== 'ACTIVE') return null;
  await prisma.session.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } });
  return { id: session.id, userId: session.user.id, email: session.user.email, roles: session.user.roles.map(({ role }) => role), expiresAt: session.expiresAt };
}

export async function revokeSession(token: string): Promise<void> {
  await prisma.session.updateMany({ where: { tokenHash: hashToken(token), revokedAt: null }, data: { revokedAt: new Date() } });
}

export async function register(input: { email: string; password: string; countryCode?: string; ipAddress?: string }) {
  const passwordHash = await hashPassword(input.password);
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({ data: { email: input.email.toLowerCase().trim(), passwordHash, countryCode: input.countryCode, roles: { create: [{ role: 'CUSTOMER' }] }, verifications: { create: [{ type: 'EMAIL', destination: input.email.toLowerCase().trim(), expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) }] } }, include: { roles: true } });
    await tx.securityEvent.create({ data: { userId: user.id, type: 'LOGIN_FAILURE', severity: 'LOW', ipAddress: input.ipAddress, details: { event: 'registration' } } });
    return user;
  });
}

export async function login(input: { email: string; password: string; ipAddress?: string; userAgent?: string }) {
  const user = await prisma.user.findUnique({ where: { email: input.email.toLowerCase().trim() }, include: { roles: true } });
  if (!user || user.status !== 'ACTIVE' || !(await verifyPassword(user.passwordHash, input.password))) {
    if (user) await prisma.securityEvent.create({ data: { userId: user.id, type: 'LOGIN_FAILURE', severity: 'MEDIUM', ipAddress: input.ipAddress } });
    throw new AuthError();
  }
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await prisma.securityEvent.create({ data: { userId: user.id, type: 'LOGIN_SUCCESS', severity: 'LOW', ipAddress: input.ipAddress, userAgent: input.userAgent } });
  return createSession(user, input);
}

export const auth = { hashPassword, verifyPassword, createSession, getSession, revokeSession, register, login };
