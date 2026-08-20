import type { VercelRequest, VercelResponse } from '@vercel/node';
import { neon } from '@neondatabase/serverless';
import { requireAdmin } from '../../lib/admin-auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const sql = neon(process.env.DATABASE_URL!);

  if (req.method === 'GET') {
    try {
      const fleets = await sql`
        SELECT
          fleet_id,
          COUNT(*)::int as vehicle_count,
          MAX(fleet_manager_email) as fleet_manager_email
        FROM vehicle_master
        WHERE company_id = ${admin.companyId}
        GROUP BY fleet_id
        ORDER BY fleet_id
      `;
      return res.status(200).json(fleets);
    } catch (error: any) {
      console.error('[API] Error:', error.message);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  if (req.method === 'PUT') {
    if (Array.isArray(req.body?.rows)) {
      const rows = req.body.rows as Array<{ fleetId?: string; fleetManagerEmail?: string }>;
      if (rows.length === 0 || rows.length > 1000) return res.status(400).json({ error: 'Import must contain 1 to 1000 rows' });
      const errors = rows.map((row, index) => !row.fleetId ? `Row ${index + 1}: Fleet ID is required` : '').filter(Boolean);
      if (errors.length) return res.status(400).json({ error: 'Import validation failed', errors });
      for (const row of rows) {
        await sql`UPDATE vehicle_master SET fleet_manager_email = ${row.fleetManagerEmail || null} WHERE company_id = ${admin.companyId} AND fleet_id = ${row.fleetId}`;
      }
      return res.status(200).json({ imported: rows.length });
    }
    const { fleetId, fleetManagerEmail } = req.body;
    if (!fleetId) return res.status(400).json({ error: 'fleetId required' });
    try {
      await sql`
        UPDATE vehicle_master SET fleet_manager_email = ${fleetManagerEmail || null}
        WHERE company_id = ${admin.companyId} AND fleet_id = ${fleetId}
      `;
      return res.status(200).json({ updated: true, fleetId });
    } catch (error: any) {
      console.error('[API] Error:', error.message);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
