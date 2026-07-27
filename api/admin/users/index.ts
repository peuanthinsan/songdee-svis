import type { VercelRequest, VercelResponse } from '@vercel/node';
import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';
import { requireAdmin } from '../../../lib/admin-auth';
import { BCRYPT_ROUNDS } from '../../../lib/api-auth';
import { isNonEmptyString, MIN_PASSWORD_LENGTH } from '../../../lib/validate';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const sql = neon(process.env.DATABASE_URL!);

  if (req.method === 'GET') {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
      const offset = parseInt(req.query.offset as string) || 0;
      const { search, role } = req.query;
      let users;
      if (search && role) {
        const pattern = `%${search as string}%`;
        users = await sql`
          SELECT id, username, first_name, last_name, role, fleet_id, created_at
          FROM users
          WHERE company_id = ${admin.companyId}
            AND role = ${role as string}
            AND (username ILIKE ${pattern} OR first_name ILIKE ${pattern} OR last_name ILIKE ${pattern} OR fleet_id ILIKE ${pattern})
          ORDER BY role, first_name
          LIMIT ${limit} OFFSET ${offset}
        `;
      } else if (search) {
        const pattern = `%${search as string}%`;
        users = await sql`
          SELECT id, username, first_name, last_name, role, fleet_id, created_at
          FROM users
          WHERE company_id = ${admin.companyId}
            AND (username ILIKE ${pattern} OR first_name ILIKE ${pattern} OR last_name ILIKE ${pattern} OR fleet_id ILIKE ${pattern})
          ORDER BY role, first_name
          LIMIT ${limit} OFFSET ${offset}
        `;
      } else if (role) {
        users = await sql`
          SELECT id, username, first_name, last_name, role, fleet_id, created_at
          FROM users
          WHERE company_id = ${admin.companyId} AND role = ${role as string}
          ORDER BY role, first_name
          LIMIT ${limit} OFFSET ${offset}
        `;
      } else {
        users = await sql`
          SELECT id, username, first_name, last_name, role, fleet_id, created_at
          FROM users
          WHERE company_id = ${admin.companyId}
          ORDER BY role, first_name
          LIMIT ${limit} OFFSET ${offset}
        `;
      }
      return res.status(200).json(users);
    } catch (error: any) {
      console.error('[API] Error:', error.message);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  if (req.method === 'POST') {
    const { username, password, firstName, lastName, role, fleetId } = req.body;
    if (!isNonEmptyString(username, 50) || !isNonEmptyString(password, 200) ||
        !isNonEmptyString(firstName, 100) || !isNonEmptyString(lastName, 100) || !role) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` });
    }
    const VALID_ROLES = ['driver', 'supervisor', 'admin'];
    if (!VALID_ROLES.includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    try {
      const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
      const [user] = await sql`
        INSERT INTO users (username, password_hash, first_name, last_name, role, fleet_id, company_id)
        VALUES (${username}, ${passwordHash}, ${firstName}, ${lastName}, ${role}, ${fleetId || ''}, ${admin.companyId})
        RETURNING id, username, first_name, last_name, role, fleet_id
      `;
      return res.status(201).json(user);
    } catch (error: any) {
      if (error.message?.includes('unique')) {
        return res.status(409).json({ error: 'Username already exists' });
      }
      console.error('[API] Error:', error.message);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
