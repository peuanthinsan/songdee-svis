import type { VercelRequest, VercelResponse } from '@vercel/node';
import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';
import { verifyAuth, BCRYPT_ROUNDS } from '../../lib/api-auth';
import { logAudit } from '../../lib/audit';
import { isNonEmptyString, MIN_PASSWORD_LENGTH } from '../../lib/validate';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const user = await verifyAuth(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  const { currentPassword, newPassword } = req.body;
  if (!isNonEmptyString(currentPassword, 200) || !isNonEmptyString(newPassword, 200)) {
    return res.status(400).json({ error: 'Current and new password required' });
  }
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` });
  }

  const sql = neon(process.env.DATABASE_URL!);

  try {
    const users = await sql`
      SELECT * FROM users
      WHERE id = ${user.userId} AND company_id = ${user.companyId}
    `;
    if (users.length === 0) return res.status(404).json({ error: 'User not found' });

    const valid = await bcrypt.compare(currentPassword, users[0].password_hash);
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });

    const newHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await sql`
      UPDATE users SET password_hash = ${newHash}, updated_at = NOW()
      WHERE id = ${user.userId} AND company_id = ${user.companyId}
    `;

    await logAudit({
      username: user.username,
      action: 'password_changed',
      entityType: 'user',
      entityId: user.userId,
    });

    res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('[API] Change password error:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
}
