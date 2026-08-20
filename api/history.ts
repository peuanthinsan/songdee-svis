import type { VercelRequest, VercelResponse } from '@vercel/node';
import { neon } from '@neondatabase/serverless';
import { verifyAuth } from '../lib/api-auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const user = await verifyAuth(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { startDate, endDate, search } = req.query;
  // Non-admins always see their own fleet from the JWT (fail closed).
  const isAdmin = user.role === 'admin';
  const fleetId = isAdmin ? (req.query.fleetId as string | undefined) : (user.fleetId || undefined);
  if (!isAdmin && !fleetId) return res.status(403).json({ error: 'Forbidden' });
  const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 100, 1), 500);
  const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);
  const vehicleSearch = typeof search === 'string' ? search.trim() : '';
  const vehiclePattern = `%${vehicleSearch}%`;
  const sql = neon(process.env.DATABASE_URL!);

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!startDate || !endDate || !dateRegex.test(startDate as string) || !dateRegex.test(endDate as string)) {
    return res.status(400).json({ error: 'Valid startDate and endDate required (YYYY-MM-DD)' });
  }

  try {
    let inspections;
    if (fleetId) {
      inspections = await sql`
        SELECT il.*, vm.plate_number, vm.vehicle_type
        FROM inspection_logs il
        JOIN vehicle_master vm ON vm.id = il.vehicle_id
        WHERE il.inspection_date >= ${startDate as string}
          AND il.inspection_date <= ${endDate as string}
          AND il.company_id = ${user.companyId}
          AND il.fleet_id = ${fleetId as string}
          AND (${vehicleSearch || null}::text IS NULL OR vm.plate_number ILIKE ${vehiclePattern})
        ORDER BY il.inspection_date DESC, il.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else {
      inspections = await sql`
        SELECT il.*, vm.plate_number, vm.vehicle_type
        FROM inspection_logs il
        JOIN vehicle_master vm ON vm.id = il.vehicle_id
        WHERE il.inspection_date >= ${startDate as string}
          AND il.inspection_date <= ${endDate as string}
          AND il.company_id = ${user.companyId}
          AND (${vehicleSearch || null}::text IS NULL OR vm.plate_number ILIKE ${vehiclePattern})
        ORDER BY il.inspection_date DESC, il.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    }

    let countResult;
    if (fleetId) {
      countResult = await sql`
        SELECT
          COUNT(*)::int as total,
          COUNT(*) FILTER (WHERE overall_status = 'pass')::int as passed,
          COUNT(*) FILTER (WHERE overall_status = 'fail')::int as failed
        FROM inspection_logs
        WHERE inspection_date >= ${startDate as string}
          AND inspection_date <= ${endDate as string}
          AND company_id = ${user.companyId}
          AND fleet_id = ${fleetId as string}
          AND (${vehicleSearch || null}::text IS NULL OR EXISTS (
            SELECT 1 FROM vehicle_master vm
            WHERE vm.id = inspection_logs.vehicle_id AND vm.plate_number ILIKE ${vehiclePattern}
          ))
      `;
    } else {
      countResult = await sql`
        SELECT
          COUNT(*)::int as total,
          COUNT(*) FILTER (WHERE overall_status = 'pass')::int as passed,
          COUNT(*) FILTER (WHERE overall_status = 'fail')::int as failed
        FROM inspection_logs
        WHERE inspection_date >= ${startDate as string}
          AND inspection_date <= ${endDate as string}
          AND company_id = ${user.companyId}
          AND (${vehicleSearch || null}::text IS NULL OR EXISTS (
            SELECT 1 FROM vehicle_master vm
            WHERE vm.id = inspection_logs.vehicle_id AND vm.plate_number ILIKE ${vehiclePattern}
          ))
      `;
    }

    const { total, passed, failed } = countResult[0];

    res.status(200).json({
      total,
      passed,
      failed,
      inspections,
    });
  } catch (error: any) {
    console.error('[API] Error:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
}
