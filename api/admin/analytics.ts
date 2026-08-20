import type { VercelRequest, VercelResponse } from '@vercel/node';
import { neon } from '@neondatabase/serverless';
import { requireAdmin } from '../../lib/admin-auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const sql = neon(process.env.DATABASE_URL!);
  const requestedDays = parseInt(req.query.days as string);
  const dateStartParam = typeof req.query.dateStart === 'string' ? req.query.dateStart : null;
  const dateEndParam = typeof req.query.dateEnd === 'string' ? req.query.dateEnd : null;
  const allTime = req.query.allTime === '1';
  const validDate = (value: string | null) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value);
  if (!validDate(dateStartParam) || !validDate(dateEndParam)) return res.status(400).json({ error: 'Invalid date range' });
  if (dateStartParam && dateEndParam && dateStartParam > dateEndParam) return res.status(400).json({ error: 'Start date must not be after end date' });
  const days = Number.isFinite(requestedDays) && requestedDays > 0 ? requestedDays : 30;
  const now = new Date(Date.now() + 7 * 60 * 60 * 1000); // Thai timezone
  now.setUTCDate(now.getUTCDate() - days);
  const sinceDate: string | null = allTime ? null : dateStartParam || now.toISOString().split('T')[0];
  const untilDate = dateEndParam;

  try {
    // 1. Top failing vehicles (top 10)
    const topFailingVehicles = await sql`
      SELECT
        vm.plate_number,
        vm.fleet_id,
        COUNT(*)::int as inspection_count,
        COUNT(*) FILTER (WHERE il.overall_status = 'fail')::int as fail_count,
        MAX(il.inspection_date)::text as last_inspection_date,
        MAX(il.inspection_date) FILTER (WHERE il.overall_status = 'fail')::text as last_failed_date
      FROM inspection_logs il
      JOIN vehicle_master vm ON vm.id = il.vehicle_id AND vm.is_active
      WHERE il.company_id = ${admin.companyId}
        AND (${sinceDate}::date IS NULL OR il.inspection_date >= ${sinceDate}::date)
        AND (${untilDate}::date IS NULL OR il.inspection_date <= ${untilDate}::date)
      GROUP BY vm.id, vm.plate_number, vm.fleet_id
      HAVING COUNT(*) FILTER (WHERE il.overall_status = 'fail') > 0
      ORDER BY (COUNT(*) FILTER (WHERE il.overall_status = 'fail')::numeric / NULLIF(COUNT(*), 0)) DESC, fail_count DESC
      LIMIT 10
    `;

    // 2. Top failing checklist items (top 10)
    const topFailingItems = await sql`
      SELECT ci.item_name_th, ci.item_name_en, COUNT(*)::int as fail_count
      FROM inspection_results ir
      JOIN inspection_logs il ON il.id = ir.inspection_id
      JOIN checklist_items ci ON ci.id = ir.checklist_item_id
      JOIN vehicle_master vm ON vm.id = il.vehicle_id AND vm.is_active
      WHERE ir.result = 'fail'
        AND il.company_id = ${admin.companyId}
        AND (${sinceDate}::date IS NULL OR il.inspection_date >= ${sinceDate}::date)
        AND (${untilDate}::date IS NULL OR il.inspection_date <= ${untilDate}::date)
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
        COUNT(*) FILTER (WHERE il.overall_status = 'fail')::int as failed,
        COUNT(DISTINCT vm.id)::int as active_vehicles
      FROM inspection_logs il
      JOIN vehicle_master vm ON vm.id = il.vehicle_id AND vm.is_active
      WHERE il.company_id = ${admin.companyId}
        AND (${sinceDate}::date IS NULL OR il.inspection_date >= ${sinceDate}::date)
        AND (${untilDate}::date IS NULL OR il.inspection_date <= ${untilDate}::date)
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
      JOIN vehicle_master vm ON vm.id = inspection_logs.vehicle_id AND vm.is_active
      WHERE inspection_logs.company_id = ${admin.companyId}
        AND (${sinceDate}::date IS NULL OR inspection_date >= ${sinceDate}::date)
        AND (${untilDate}::date IS NULL OR inspection_date <= ${untilDate}::date)
        AND frequency = 'daily'
      GROUP BY inspection_date
      ORDER BY inspection_date
    `;

    // 5. Completion rate trend (inspected vehicles / total vehicles per day) — daily only
    const totalVehicles = await sql`
      SELECT COUNT(*)::int as count
      FROM vehicle_master
      WHERE company_id = ${admin.companyId} AND is_active
    `;
    const vehicleCount = totalVehicles[0].count;
    const completionTrend = await sql`
      SELECT
        inspection_date::text as date,
        COUNT(DISTINCT vehicle_id)::int as inspected
      FROM inspection_logs
      JOIN vehicle_master vm ON vm.id = inspection_logs.vehicle_id AND vm.is_active
      WHERE inspection_logs.company_id = ${admin.companyId}
        AND (${sinceDate}::date IS NULL OR inspection_date >= ${sinceDate}::date)
        AND (${untilDate}::date IS NULL OR inspection_date <= ${untilDate}::date)
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
        AND (${sinceDate}::date IS NULL OR ir.updated_at::date >= ${sinceDate}::date)
        AND (${untilDate}::date IS NULL OR ir.updated_at::date <= ${untilDate}::date)
      GROUP BY date_trunc('week', ir.updated_at)
      ORDER BY period
    `;

    const summary = await sql`
      SELECT
        COUNT(*)::int as total_inspections,
        COUNT(*) FILTER (WHERE overall_status = 'pass')::int as passed,
        COUNT(*) FILTER (WHERE overall_status = 'fail')::int as failed
      FROM inspection_logs il
      JOIN vehicle_master vm ON vm.id = il.vehicle_id AND vm.is_active
      WHERE il.company_id = ${admin.companyId}
        AND (${sinceDate}::date IS NULL OR il.inspection_date >= ${sinceDate}::date)
        AND (${untilDate}::date IS NULL OR il.inspection_date <= ${untilDate}::date)
    `;
    const openIssues = await sql`
      SELECT COUNT(*)::int as count
      FROM issue_reports ir
      JOIN vehicle_master vm ON vm.id = ir.vehicle_id AND vm.is_active
      WHERE ir.company_id = ${admin.companyId}
        AND ir.status IN ('open', 'in_progress')
    `;

    res.status(200).json({
      topFailingVehicles: topFailingVehicles.map((v: any) => ({
        ...v,
        fail_rate: v.inspection_count > 0 ? Math.round((v.fail_count / v.inspection_count) * 100) : 0,
      })),
      topFailingItems,
      fleetStats,
      dailyTrend,
      completionTrend: completionTrend.map((d: any) => ({
        ...d,
        total: vehicleCount,
        rate: vehicleCount > 0 ? Math.round((d.inspected / vehicleCount) * 100) : 0,
      })),
      resolutionTrend,
      summary: {
        totalInspections: summary[0].total_inspections,
        passed: summary[0].passed,
        failed: summary[0].failed,
        passRate: summary[0].total_inspections > 0 ? Math.round((summary[0].passed / summary[0].total_inspections) * 100) : 0,
        openIssues: openIssues[0].count,
        activeVehicles: vehicleCount,
      },
      period: { days: allTime || dateStartParam || dateEndParam ? null : days, since: sinceDate, until: untilDate },
    });
  } catch (error: any) {
    console.error('[API] Error:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
}
