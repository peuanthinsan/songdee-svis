import type { VercelRequest } from '@vercel/node';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('[FATAL] JWT_SECRET environment variable is not set');
}

export const BCRYPT_ROUNDS = 12;
export const JWT_EXPIRY = '7d';

export type AuthUser = {
  userId: string;
  username: string;
  role: 'driver' | 'supervisor' | 'admin';
  fleetId: string;
  companyId: string;
  companySlug: string;
  companyName: string;
  firstName?: string;
  lastName?: string;
};

export function getJwtSecret(): string {
  if (!JWT_SECRET) throw new Error('JWT_SECRET is not configured');
  return JWT_SECRET;
}

export function signToken(payload: Record<string, any>): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: JWT_EXPIRY });
}

export async function verifyAuth(req: VercelRequest): Promise<AuthUser | null> {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return null;

  try {
    const payload = jwt.verify(token, getJwtSecret()) as any;
    // Tokens issued before the SVIS tenancy migration are intentionally invalidated.
    // This prevents an unscoped legacy session from ever falling through to all companies.
    if (!payload.companyId) return null;
    return {
      userId: payload.userId,
      username: payload.username || '',
      role: payload.role || 'driver',
      fleetId: payload.fleetId || '',
      companyId: payload.companyId || '',
      companySlug: payload.companySlug || 'dhl',
      companyName: payload.companyName || 'DHL Express',
      firstName: payload.firstName,
      lastName: payload.lastName,
    };
  } catch {
    return null;
  }
}
