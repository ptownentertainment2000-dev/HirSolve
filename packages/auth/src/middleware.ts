import { getSession, type AuthSession } from './index';

export const SESSION_COOKIE = 'hirsolve_session';

export type CookieOptions = {
  httpOnly: true;
  secure: boolean;
  sameSite: 'lax' | 'strict';
  path: '/';
  maxAge: number;
};

export function sessionCookieOptions(maxAgeSeconds = 60 * 60 * 24 * 30): CookieOptions {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: maxAgeSeconds,
  };
}

export function readSessionToken(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const cookie = cookieHeader.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${SESSION_COOKIE}=`));
  return cookie ? decodeURIComponent(cookie.slice(SESSION_COOKIE.length + 1)) : null;
}

export async function authenticateRequest(request: Request): Promise<AuthSession | null> {
  const token = readSessionToken(request.headers.get('cookie'));
  return token ? getSession(token) : null;
}

export async function requireAuthenticatedRequest(request: Request): Promise<AuthSession> {
  const session = await authenticateRequest(request);
  if (!session) throw new Error('Authentication required');
  return session;
}

export function setSessionCookie(token: string): string {
  const options = sessionCookieOptions();
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Max-Age=${options.maxAge}; Path=${options.path}; SameSite=${options.sameSite}${options.secure ? '; Secure' : ''}; HttpOnly`;
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax${process.env.NODE_ENV === 'production' ? '; Secure' : ''}; HttpOnly`;
}
