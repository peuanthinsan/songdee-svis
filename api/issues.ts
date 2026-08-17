import type { VercelRequest, VercelResponse } from '@vercel/node';
import { neon } from '@neondatabase/serverless';
import { verifyAuth } from '../lib/api-auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const user = await verifyAuth(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { status, fleetId, search } = req.query;
  const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 50, 1), 200);
  const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);
  const sql = neon(process.env.DATABASE_URL!);

  try {
    const s = status as string | undefined;
    // Fleet scope is enforced here, not by RLS (the DATABASE_URL role bypasses it):
    // non-admins are confined to their own fleet regardless of any client-supplied fleetId.
    const isAdmin = user.role === 'admin';
    const f = isAdmin ? (fleetId as string | undefined) : (user.fleetId || undefined);
    if (!isAdmin && !f) return res.status(403).json({ error: 'Forbidden' });
    const q = search ? `%${search as string}%` : undefined;

    let issues;
    if (s && f && q) {
      issues = await sql`
        SELECT ir.*, vm.plate_number, vm.vehicle_type, vm.fleet_id as vehicle_fleet,
          il.inspector_name, il.inspection_date
        FROM issue_reports ir
        JOIN vehicle_master vm ON vm.id = ir.vehicle_id
        LEFT JOIN inspection_logs il ON il.id = ir.inspection_id
        WHERE ir.company_id = ${user.companyId} AND ir.status = ${s} AND vm.fleet_id = ${f}
          AND (vm.plate_number ILIKE ${q} OR vm.fleet_id ILIKE ${q})
        ORDER BY ir.updated_at DESC NULLS LAST, ir.created_at DESC LIMIT ${limit} OFFSET ${offset}`;
    } else if (s && f) {
      issues = await sql`
        SELECT ir.*, vm.plate_number, vm.vehicle_type, vm.fleet_id as vehicle_fleet,
          il.inspector_name, il.inspection_date
        FROM issue_reports ir
        JOIN vehicle_master vm ON vm.id = ir.vehicle_id
        LEFT JOIN inspection_logs il ON il.id = ir.inspection_id
        WHERE ir.company_id = ${user.companyId} AND ir.status = ${s} AND vm.fleet_id = ${f}
        ORDER BY ir.updated_at DESC NULLS LAST, ir.created_at DESC LIMIT ${limit} OFFSET ${offset}`;
    } else if (s && q) {
      issues = await sql`
        SELECT ir.*, vm.plate_number, vm.vehicle_type, vm.fleet_id as vehicle_fleet,
          il.inspector_name, il.inspection_date
        FROM issue_reports ir
        JOIN vehicle_master vm ON vm.id = ir.vehicle_id
        LEFT JOIN inspection_logs il ON il.id = ir.inspection_id
        WHERE ir.company_id = ${user.companyId} AND ir.status = ${s} AND (vm.plate_number ILIKE ${q} OR vm.fleet_id ILIKE ${q})
        ORDER BY ir.updated_at DESC NULLS LAST, ir.created_at DESC LIMIT ${limit} OFFSET ${offset}`;
    } else if (f && q) {
      issues = await sql`
        SELECT ir.*, vm.plate_number, vm.vehicle_type, vm.fleet_id as vehicle_fleet,
          il.inspector_name, il.inspection_date
        FROM issue_reports ir
        JOIN vehicle_master vm ON vm.id = ir.vehicle_id
        LEFT JOIN inspection_logs il ON il.id = ir.inspection_id
        WHERE ir.company_id = ${user.companyId} AND vm.fleet_id = ${f} AND (vm.plate_number ILIKE ${q} OR vm.fleet_id ILIKE ${q})
        ORDER BY ir.updated_at DESC NULLS LAST, ir.created_at DESC LIMIT ${limit} OFFSET ${offset}`;
    } else if (s) {
      issues = await sql`
        SELECT ir.*, vm.plate_number, vm.vehicle_type, vm.fleet_id as vehicle_fleet,
          il.inspector_name, il.inspection_date
        FROM issue_reports ir
        JOIN vehicle_master vm ON vm.id = ir.vehicle_id
        LEFT JOIN inspection_logs il ON il.id = ir.inspection_id
        WHERE ir.company_id = ${user.companyId} AND ir.status = ${s}
        ORDER BY ir.updated_at DESC NULLS LAST, ir.created_at DESC LIMIT ${limit} OFFSET ${offset}`;
    } else if (f) {
      issues = await sql`
        SELECT ir.*, vm.plate_number, vm.vehicle_type, vm.fleet_id as vehicle_fleet,
          il.inspector_name, il.inspection_date
        FROM issue_reports ir
        JOIN vehicle_master vm ON vm.id = ir.vehicle_id
        LEFT JOIN inspection_logs il ON il.id = ir.inspection_id
        WHERE ir.company_id = ${user.companyId} AND vm.fleet_id = ${f}
        ORDER BY ir.updated_at DESC NULLS LAST, ir.created_at DESC LIMIT ${limit} OFFSET ${offset}`;
    } else if (q) {
      issues = await sql`
        SELECT ir.*, vm.plate_number, vm.vehicle_type, vm.fleet_id as vehicle_fleet,
          il.inspector_name, il.inspection_date
        FROM issue_reports ir
        JOIN vehicle_master vm ON vm.id = ir.vehicle_id
        LEFT JOIN inspection_logs il ON il.id = ir.inspection_id
        WHERE ir.company_id = ${user.companyId}
          AND (vm.plate_number ILIKE ${q} OR vm.fleet_id ILIKE ${q})
        ORDER BY ir.updated_at DESC NULLS LAST, ir.created_at DESC LIMIT ${limit} OFFSET ${offset}`;
    } else {
      issues = await sql`
        SELECT ir.*, vm.plate_number, vm.vehicle_type, vm.fleet_id as vehicle_fleet,
          il.inspector_name, il.inspection_date
        FROM issue_reports ir
        JOIN vehicle_master vm ON vm.id = ir.vehicle_id
        LEFT JOIN inspection_logs il ON il.id = ir.inspection_id
        WHERE ir.company_id = ${user.companyId}
        ORDER BY ir.updated_at DESC NULLS LAST, ir.created_at DESC LIMIT ${limit} OFFSET ${offset}`;
    }

    // The linked failed inspection is the source of truth for defect evidence.
    // Backfill the response from its failed checklist results so an older or
    // previously refreshed issue row cannot hide photos from the latest fail.
    const inspectionIds = issues.map((issue: any) => issue.inspection_id).filter(Boolean);
    if (inspectionIds.length > 0) {
      const failedPhotos = await sql`
        SELECT ir.inspection_id,
               ARRAY_AGG(photo_url) AS defect_photo_urls
        FROM inspection_results ir
        CROSS JOIN LATERAL unnest(ir.photo_urls) AS photo_url
        WHERE ir.inspection_id = ANY(${inspectionIds}::uuid[])
          AND ir.result = 'fail'
        GROUP BY ir.inspection_id
      `;
      const photosByInspection = new Map<string, string[]>(
        failedPhotos.map((row: any) => [row.inspection_id, row.defect_photo_urls || []]),
      );
      for (const issue of issues) {
        const photos = photosByInspection.get(issue.inspection_id);
        if (photos?.length) issue.defect_photo_urls = photos;
      }
    }
    res.status(200).json({ issues, limit, offset });
  } catch (error: any) {
    console.error('[API] Error:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
}
