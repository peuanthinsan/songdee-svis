import type { VercelRequest, VercelResponse } from '@vercel/node';
import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';
import { signToken } from '../../lib/api-auth';
import { logAudit } from '../../lib/audit';
import { isNonEmptyString } from '../../lib/validate';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { username, password, companySlug = 'dhl' } = req.body;
  if (!isNonEmptyString(username, 100) || !isNonEmptyString(password, 200)) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  if (!isNonEmptyString(companySlug, 100)) {
    return res.status(400).json({ error: 'Company required' });
  }

  const sql = neon(process.env.DATABASE_URL!);

  try {
    const users = await sql`
      SELECT u.*, c.slug AS company_slug, c.name AS company_name
      FROM users u
      JOIN companies c ON c.id = u.company_id
      WHERE u.username = ${username}
        AND c.slug = ${companySlug}
        AND c.is_active
    `;
    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = users[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Deactivated staff keep their row (audit history references it) but cannot sign in.
    // Same generic message as a bad password so the response can't enumerate accounts.
    if (user.is_active === false) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = signToken({
      userId: user.id,
      username: user.username,
      role: user.role,
      fleetId: user.fleet_id,
      companyId: user.company_id,
      companySlug: user.company_slug,
      companyName: user.company_name,
      firstName: user.first_name,
      lastName: user.last_name,
    });

    await logAudit({
      userId: user.id,
      username: user.username,
      action: 'login',
      entityType: 'user',
      entityId: user.id,
    });

    res.status(200).json({
      token,
      user: {
        id: user.id,
        username: user.username,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        fleetId: user.fleet_id,
        companyId: user.company_id,
        companySlug: user.company_slug,
        companyName: user.company_name,
      },
    });
  } catch (error: any) {
    console.error('[API] Login error:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
}
