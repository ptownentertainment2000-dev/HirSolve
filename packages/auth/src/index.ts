export type AuthSession = {
  userId: string;
  email: string;
  roles: string[];
  issuedAt: number;
  expiresAt: number;
};

export const auth = {
  name: 'auth',
  createSession: (userId: string, email: string, roles: string[]) => ({
    userId,
    email,
    roles,
    issuedAt: Date.now(),
    expiresAt: Date.now() + 1000 * 60 * 60,
  }),
};
