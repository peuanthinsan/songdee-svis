import type { VercelRequest, VercelResponse } from '@vercel/node';
import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';
import { requireAdmin } from '../../../lib/admin-auth';
import { BCRYPT_ROUNDS } from '../../../lib/api-auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const { id } = req.query;
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'User ID required' });
  }

  const sql = neon(process.env.DATABASE_URL!);

  if (req.method === 'PUT') {
    const { firstName, lastName, role, fleetId, password } = req.body;
    if (role && !['driver', 'supervisor', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    try {
      if (password) {
        const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
        await sql`
          UPDATE users SET password_hash = ${passwordHash}, updated_at = NOW()
          WHERE id = ${id} AND company_id = ${admin.companyId}
        `;
      }
      const [user] = await sql`
        UPDATE users SET
          first_name = COALESCE(${firstName || null}, first_name),
          last_name = COALESCE(${lastName || null}, last_name),
          role = COALESCE(${role || null}, role),
          fleet_id = COALESCE(${fleetId || null}, fleet_id),
          updated_at = NOW()
        WHERE id = ${id} AND company_id = ${admin.companyId}
        RETURNING id, username, first_name, last_name, role, fleet_id
      `;
      if (!user) return res.status(404).json({ error: 'User not found' });
      return res.status(200).json(user);
    } catch (error: any) {
      console.error('[API] Error:', error.message);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const result = await sql`
        DELETE FROM users
        WHERE id = ${id} AND company_id = ${admin.companyId}
        RETURNING id
      `;
      if (result.length === 0) return res.status(404).json({ error: 'User not found' });
      return res.status(200).json({ deleted: true });
    } catch (error: any) {
      console.error('[API] Error:', error.message);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
