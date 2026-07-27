import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyAuth, AuthUser } from './api-auth';

export async function requireAdmin(req: VercelRequest, res: VercelResponse): Promise<AuthUser | null> {
  const user = await verifyAuth(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  if (user.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return null;
  }
  return user;
}
