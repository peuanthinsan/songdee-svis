import type { VercelRequest, VercelResponse } from '@vercel/node';
import { neon } from '@neondatabase/serverless';
import { requireAdmin } from '../../lib/admin-auth';

const ALLOWED_KEYS = ['unit_status_sheet_url'];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const sql = neon(process.env.DATABASE_URL!);

  if (req.method === 'GET') {
    try {
      const rows = await sql`
        SELECT key, value FROM app_settings
        WHERE company_id = ${admin.companyId} AND key = ANY(${ALLOWED_KEYS})
      `;
      const settings: Record<string, string> = {};
      for (const r of rows) settings[r.key] = r.value;
      return res.status(200).json(settings);
    } catch (error: any) {
      console.error('[settings GET]', error.message);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  if (req.method === 'PUT') {
    try {
      const { key, value } = req.body as { key?: string; value?: string };
      if (!key || !ALLOWED_KEYS.includes(key)) {
        return res.status(400).json({ error: 'Invalid settings key' });
      }
      if (typeof value !== 'string') {
        return res.status(400).json({ error: 'Value must be a string' });
      }
      await sql`
        INSERT INTO app_settings (company_id, key, value, updated_at)
        VALUES (${admin.companyId}, ${key}, ${value}, NOW())
        ON CONFLICT (company_id, key)
        DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
      `;
      return res.status(200).json({ ok: true });
    } catch (error: any) {
      console.error('[settings PUT]', error.message);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
