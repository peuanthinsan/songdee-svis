import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyAuth, signToken } from '../../lib/api-auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const user = await verifyAuth(req);
  if (!user) return res.status(401).json({ error: 'Invalid or expired token' });

  const token = signToken({
    userId: user.userId,
    username: user.username,
    role: user.role,
    fleetId: user.fleetId,
    companyId: user.companyId,
    companySlug: user.companySlug,
    companyName: user.companyName,
    firstName: user.firstName,
    lastName: user.lastName,
  });

  res.status(200).json({ token });
}
