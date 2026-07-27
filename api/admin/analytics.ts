import type { VercelRequest, VercelResponse } from '@vercel/node';
import { neon } from '@neondatabase/serverless';
import { requireAdmin } from '../../lib/admin-auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const sql = neon(process.env.DATABASE_URL!);
  const days = parseInt(req.query.days as string) || 30;
  const now = new Date(Date.now() + 7 * 60 * 60 * 1000); // Thai timezone
  now.setUTCDate(now.getUTCDate() - days);
  const sinceDate = now.toISOString().split('T')[0];

  try {
    // 1. Top failing vehicles (top 10)
    const topFailingVehicles = await sql`
      SELECT vm.plate_number, vm.fleet_id, COUNT(*)::int as fail_count
      FROM inspection_logs il
      JOIN vehicle_master vm ON vm.id = il.vehicle_id
      WHERE il.overall_status = 'fail'
        AND il.company_id = ${admin.companyId}
        AND il.inspection_date >= ${sinceDate}
      GROUP BY vm.id, vm.plate_number, vm.fleet_id
      ORDER BY fail_count DESC
      LIMIT 10
    `;

    // 2. Top failing checklist items (top 10)
    const topFailingItems = await sql`
      SELECT ci.item_name_th, ci.item_name_en, COUNT(*)::int as fail_count
      FROM inspection_results ir
      JOIN inspection_logs il ON il.id = ir.inspection_id
      JOIN checklist_items ci ON ci.id = ir.checklist_item_id
      WHERE ir.result = 'fail'
        AND il.company_id = ${admin.companyId}
        AND il.inspection_date >= ${sinceDate}
      GROUP BY ci.id, ci.item_name_th, ci.item_name_en
      ORDER BY fail_count DESC
      LIMIT 10
    `;

    // 3. Fleet comparison
    const fleetStats = await sql`
      SELECT
        il.fleet_id,
        COUNT(*)::int as total,
        COUNT(*) FILTER (WHERE il.overall_status = 'pass')::int as passed,
        COUNT(*) FILTER (WHERE il.overall_status = 'fail')::int as failed
      FROM inspection_logs il
      WHERE il.company_id = ${admin.companyId}
        AND il.inspection_date >= ${sinceDate}
      GROUP BY il.fleet_id
      ORDER BY il.fleet_id
    `;

    // 4. Daily trend (pass vs fail per day, last N days) — daily inspections only
    const dailyTrend = await sql`
      SELECT
        inspection_date::text as date,
        COUNT(*) FILTER (WHERE overall_status = 'pass')::int as passed,
        COUNT(*) FILTER (WHERE overall_status = 'fail')::int as failed
      FROM inspection_logs
      WHERE company_id = ${admin.companyId}
        AND inspection_date >= ${sinceDate}
        AND frequency = 'daily'
      GROUP BY inspection_date
      ORDER BY inspection_date
    `;

    // 5. Completion rate trend (inspected vehicles / total vehicles per day) — daily only
    const totalVehicles = await sql`
      SELECT COUNT(*)::int as count
      FROM vehicle_master
      WHERE company_id = ${admin.companyId}
    `;
    const vehicleCount = totalVehicles[0].count;
    const completionTrend = await sql`
      SELECT
        inspection_date::text as date,
        COUNT(DISTINCT vehicle_id)::int as inspected
      FROM inspection_logs
      WHERE company_id = ${admin.companyId}
        AND inspection_date >= ${sinceDate}
        AND frequency = 'daily'
      GROUP BY inspection_date
      ORDER BY inspection_date
    `;

    // 6. Issue resolution time trend (avg hours to resolve, by week)
    const resolutionTrend = await sql`
      SELECT
        date_trunc('week', ir.updated_at)::date::text as period,
        AVG(EXTRACT(EPOCH FROM (ir.updated_at - ir.created_at)) / 3600)::numeric(10,1) as avg_hours,
        COUNT(*)::int as count
      FROM issue_reports ir
      WHERE ir.status = 'completed'
        AND ir.company_id = ${admin.companyId}
        AND ir.updated_at >= ${sinceDate}
      GROUP BY date_trunc('week', ir.updated_at)
      ORDER BY period
    `;

    res.status(200).json({
      topFailingVehicles,
      topFailingItems,
      fleetStats,
      dailyTrend,
      completionTrend: completionTrend.map((d: any) => ({
        ...d,
        total: vehicleCount,
        rate: vehicleCount > 0 ? Math.round((d.inspected / vehicleCount) * 100) : 0,
      })),
      resolutionTrend,
      period: { days, since: sinceDate },
    });
  } catch (error: any) {
    console.error('[API] Error:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
}
