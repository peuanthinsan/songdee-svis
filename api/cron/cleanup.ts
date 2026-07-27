import type { VercelRequest, VercelResponse } from '@vercel/node';
import { neon } from '@neondatabase/serverless';

// Retention policy: keep at most 6 months of operational history.
// Runs daily via Vercel Cron (see vercel.json). Authenticated with CRON_SECRET.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Vercel Cron attaches Authorization: Bearer <CRON_SECRET>
  const expected = process.env.CRON_SECRET;
  const provided = req.headers.authorization?.replace('Bearer ', '');
  if (!expected || provided !== expected) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const sql = neon(process.env.DATABASE_URL!);

  try {
    // Delete issue_reports tied to stale inspections first
    // (no ON DELETE CASCADE on issue_reports.inspection_id FK).
    const deletedIssues = await sql`
      DELETE FROM issue_reports
      WHERE inspection_id IN (
        SELECT id FROM inspection_logs
        WHERE inspection_date < (CURRENT_DATE - INTERVAL '6 months')
      )
      RETURNING id
    `;

    // inspection_results cascade via FK ON DELETE CASCADE.
    const deletedLogs = await sql`
      DELETE FROM inspection_logs
      WHERE inspection_date < (CURRENT_DATE - INTERVAL '6 months')
      RETURNING id
    `;

    const deletedAudit = await sql`
      DELETE FROM audit_log
      WHERE created_at < (NOW() - INTERVAL '6 months')
      RETURNING id
    `;

    return res.status(200).json({
      ok: true,
      retention: '6 months',
      deleted: {
        inspection_logs: deletedLogs.length,
        issue_reports: deletedIssues.length,
        audit_log: deletedAudit.length,
      },
    });
  } catch (error: any) {
    console.error('[cron/cleanup] Error:', error.message);
    return res.status(500).json({ error: 'Cleanup failed' });
  }
}
