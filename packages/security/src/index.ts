import { prisma, type RiskLevel, type SecurityEventType } from '@hirsolve/db';

export type RateLimitResult = { allowed: boolean; remaining: number; retryAfterSeconds: number };

export async function recordSecurityEvent(input: { userId?: string; type: SecurityEventType; severity?: RiskLevel; ipAddress?: string; userAgent?: string; details?: object }) {
  return prisma.securityEvent.create({ data: { userId: input.userId, type: input.type, severity: input.severity ?? 'LOW', ipAddress: input.ipAddress, userAgent: input.userAgent, details: input.details } });
}

export async function checkRateLimit(input: { key: string; limit: number; windowMs: number }): Promise<RateLimitResult> {
  // Stage 1 uses a process-local limiter. Production deployments must replace this
  // with a shared Redis/edge limiter so limits apply across API instances.
  const now = Date.now();
  const entry = rateLimitStore.get(input.key);
  if (!entry || entry.resetAt <= now) {
    rateLimitStore.set(input.key, { count: 1, resetAt: now + input.windowMs });
    return { allowed: true, remaining: Math.max(0, input.limit - 1), retryAfterSeconds: Math.ceil(input.windowMs / 1000) };
  }
  entry.count += 1;
  const allowed = entry.count <= input.limit;
  return { allowed, remaining: Math.max(0, input.limit - entry.count), retryAfterSeconds: Math.ceil((entry.resetAt - now) / 1000) };
}

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();
