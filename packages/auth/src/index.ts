import argon2 from 'argon2';
import { createHash, randomBytes } from 'node:crypto';
import { prisma, type Role, type StepUpAction, type User } from '@hirsolve/db';

export type AuthSession = { id: string; userId: string; email: string; roles: Role[]; expiresAt: Date };
export class AuthError extends Error { constructor(message = 'Invalid credentials') { super(message); this.name = 'AuthError'; } }
export class StepUpRequiredError extends AuthError { constructor() { super('Recent step-up authentication is required'); this.name = 'StepUpRequiredError'; } }

export async function hashPassword(password: string) {
  if (password.length < 12) throw new AuthError('Password must be at least 12 characters');
  return argon2.hash(password, { type: argon2.argon2id });
}
export async function verifyPassword(hash: string, password: string) { try { return await argon2.verify(hash, password); } catch { return false; } }
export function generateSessionToken() { return randomBytes(32).toString('base64url'); }
const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export async function createSession(user: Pick<User, 'id' | 'email'> & { roles: { role: Role }[] }, options?: { ipAddress?: string; userAgent?: string; ttlMs?: number }) {
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + (options?.ttlMs ?? 30 * 24 * 60 * 60 * 1000));
  const session = await prisma.session.create({ data: { userId: user.id, tokenHash: hashToken(token), expiresAt, ipAddress: options?.ipAddress, userAgent: options?.userAgent } });
  return { token, session: { id: session.id, userId: user.id, email: user.email, roles: user.roles.map(({ role }) => role), expiresAt } satisfies AuthSession };
}
export async function getSession(token: string): Promise<AuthSession | null> {
  const session = await prisma.session.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: { include: { roles: true } } } });
  if (!session || session.revokedAt || session.expiresAt <= new Date() || session.user.status !== 'ACTIVE') return null;
  await prisma.session.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } });
  return { id: session.id, userId: session.user.id, email: session.user.email, roles: session.user.roles.map(({ role }) => role), expiresAt: session.expiresAt };
}
export async function revokeSession(token: string) { await prisma.session.updateMany({ where: { tokenHash: hashToken(token), revokedAt: null }, data: { revokedAt: new Date() } }); }

export async function createStepUpGrant(session: AuthSession, action: StepUpAction, ttlMs = 5 * 60 * 1000) {
  const token = randomBytes(32).toString('base64url');
  await prisma.stepUpGrant.create({ data: { userId: session.userId, sessionId: session.id, action, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + ttlMs) } });
  await prisma.securityEvent.create({ data: { userId: session.userId, type: 'STEP_UP_SUCCESS', severity: 'LOW', details: { action } } });
  return token;
}
export async function consumeStepUpGrant(session: AuthSession, action: StepUpAction, token: string) {
  const grant = await prisma.stepUpGrant.findFirst({ where: { userId: session.userId, sessionId: session.id, action, tokenHash: hashToken(token), consumedAt: null, expiresAt: { gt: new Date() } } });
  if (!grant) throw new StepUpRequiredError();
  await prisma.stepUpGrant.update({ where: { id: grant.id }, data: { consumedAt: new Date() } });
}

export const requireStepUp = consumeStepUpGrant;
export const auth = { hashPassword, verifyPassword, createSession, getSession, revokeSession, createStepUpGrant, consumeStepUpGrant, requireStepUp };
