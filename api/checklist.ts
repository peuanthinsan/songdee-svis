import type { VercelRequest, VercelResponse } from '@vercel/node';
import { neon } from '@neondatabase/serverless';
import { verifyAuth } from '../lib/api-auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const user = await verifyAuth(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { vehicleType, frequency } = req.query;
  const sql = neon(process.env.DATABASE_URL!);

  try {
    const items = await sql`
      SELECT id, vehicle_type, frequency, item_name_th, item_name_en, sort_order, section
      FROM checklist_items
      WHERE company_id = ${user.companyId}
        AND vehicle_type = ${vehicleType as string}
        AND frequency = ${frequency as string}
      ORDER BY sort_order
    `;
    res.status(200).json(items);
  } catch (error: any) {
    console.error('[API] Error:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
}
