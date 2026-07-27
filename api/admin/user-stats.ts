import type { VercelRequest, VercelResponse } from '@vercel/node';
import { neon } from '@neondatabase/serverless';
import { requireAdmin } from '../../lib/admin-auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const sql = neon(process.env.DATABASE_URL!);

  try {
    const total = await sql`
      SELECT COUNT(*) as count FROM users WHERE company_id = ${admin.companyId}
    `;
    const byRole = await sql`
      SELECT role, COUNT(*) as count FROM users
      WHERE company_id = ${admin.companyId}
      GROUP BY role ORDER BY role
    `;
    const byFleet = await sql`
      SELECT fleet_id, COUNT(*) as count FROM users
      WHERE company_id = ${admin.companyId}
      GROUP BY fleet_id ORDER BY fleet_id
    `;

    res.status(200).json({
      total: parseInt(total[0].count),
      byRole: byRole.map((r: any) => ({ role: r.role, count: parseInt(r.count) })),
      byFleet: byFleet.map((f: any) => ({ fleetId: f.fleet_id, count: parseInt(f.count) })),
    });
  } catch (error: any) {
    console.error('[API] Error:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
}
