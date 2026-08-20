import type { VercelRequest, VercelResponse } from '@vercel/node';
import { neon } from '@neondatabase/serverless';
import { requireAdmin } from '../../lib/admin-auth';

const STATUSES = ['open', 'in_progress', 'completed'];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const rows = Array.isArray(req.body?.rows) ? req.body.rows as Array<{ issueId?: string; status?: string }> : [];
  if (rows.length === 0 || rows.length > 1000) return res.status(400).json({ error: 'Import must contain 1 to 1000 rows' });
  const errors = rows.map((row, index) => {
    if (!row.issueId || !row.status) return `Row ${index + 1}: Issue ID and Status are required`;
    if (!STATUSES.includes(row.status)) return `Row ${index + 1}: invalid status`;
    return '';
  }).filter(Boolean);
  if (errors.length) return res.status(400).json({ error: 'Import validation failed', errors: errors.slice(0, 20) });
  try {
    const sql = neon(process.env.DATABASE_URL!);
    let imported = 0;
    for (const row of rows) {
      const result = await sql`UPDATE issue_reports SET status = ${row.status}, updated_at = NOW() WHERE id = ${row.issueId} AND company_id = ${admin.companyId} RETURNING id`;
      imported += result.length;
    }
    return res.status(200).json({ imported });
  } catch (error: any) {
    console.error('[API] Issue import error:', error.message);
    return res.status(400).json({ error: error.message || 'Import failed' });
  }
}
