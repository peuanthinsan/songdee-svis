import type { VercelRequest, VercelResponse } from '@vercel/node';
import { neon } from '@neondatabase/serverless';
import { requireAdmin } from '../../lib/admin-auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const sql = neon(process.env.DATABASE_URL!);

  if (req.method === 'GET') {
    try {
      const { vehicleType, frequency } = req.query;
      const returnAll = req.query.all === '1';
      // PostgreSQL treats LIMIT NULL as unlimited. Editors use this one-shot
      // snapshot so concurrent checklist mutations cannot shift OFFSET pages.
      const limit = returnAll
        ? null
        : Math.min(parseInt(req.query.limit as string) || 500, 500);
      const offset = returnAll ? 0 : (parseInt(req.query.offset as string) || 0);
      let items;
      if (vehicleType && frequency) {
        items = await sql`
          SELECT * FROM checklist_items
          WHERE company_id = ${admin.companyId}
            AND is_active
            AND vehicle_type = ${vehicleType as string}
            AND frequency = ${frequency as string}
          ORDER BY sort_order, id
          LIMIT ${limit} OFFSET ${offset}
        `;
      } else if (vehicleType) {
        items = await sql`
          SELECT * FROM checklist_items
          WHERE company_id = ${admin.companyId}
            AND is_active
            AND vehicle_type = ${vehicleType as string}
          ORDER BY frequency, sort_order, id
          LIMIT ${limit} OFFSET ${offset}
        `;
      } else {
        items = await sql`
          SELECT * FROM checklist_items
          WHERE company_id = ${admin.companyId}
            AND is_active
          ORDER BY frequency, vehicle_type, sort_order, id
          LIMIT ${limit} OFFSET ${offset}
        `;
      }
      return res.status(200).json(items);
    } catch (error: any) {
      console.error('[API] Error:', error.message);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  if (req.method === 'POST') {
    const { vehicleType, frequency, itemNameTh, itemNameEn, sortOrder } = req.body;
    if (!vehicleType || !frequency || !itemNameTh || !itemNameEn) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    if (!['daily', 'weekly', 'post_route'].includes(frequency)) {
      return res.status(400).json({ error: 'Invalid frequency' });
    }
    try {
      const [item] = await sql`
        INSERT INTO checklist_items (vehicle_type, frequency, item_name_th, item_name_en, sort_order, company_id)
        VALUES (${vehicleType}, ${frequency}, ${itemNameTh}, ${itemNameEn}, ${sortOrder || 0}, ${admin.companyId})
        RETURNING *
      `;
      return res.status(201).json(item);
    } catch (error: any) {
      console.error('[API] Error:', error.message);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  if (req.method === 'PUT') {
    const { id, itemNameTh, itemNameEn, sortOrder, vehicleType, frequency } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });
    if (frequency && !['daily', 'weekly', 'post_route'].includes(frequency)) {
      return res.status(400).json({ error: 'Invalid frequency' });
    }
    try {
      const [item] = await sql`
        UPDATE checklist_items SET
          item_name_th = COALESCE(${itemNameTh || null}, item_name_th),
          item_name_en = COALESCE(${itemNameEn || null}, item_name_en),
          sort_order = COALESCE(${sortOrder ?? null}, sort_order),
          vehicle_type = COALESCE(${vehicleType || null}, vehicle_type),
          frequency = COALESCE(${frequency || null}, frequency)
        WHERE id = ${id} AND company_id = ${admin.companyId}
        RETURNING *
      `;
      if (!item) return res.status(404).json({ error: 'Item not found' });
      return res.status(200).json(item);
    } catch (error: any) {
      console.error('[API] Error:', error.message);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  if (req.method === 'DELETE') {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'id required' });
    try {
      // Check if item has been used in inspections
      const usage = await sql`
        SELECT COUNT(*)::int as count
        FROM inspection_results ir
        JOIN checklist_items ci ON ci.id = ir.checklist_item_id
        WHERE ir.checklist_item_id = ${id as string}
          AND ci.company_id = ${admin.companyId}
      `;
      if (usage[0].count > 0) {
        const [retired] = await sql`
          UPDATE checklist_items
          SET is_active = false
          WHERE id = ${id as string} AND company_id = ${admin.companyId}
          RETURNING id
        `;
        if (!retired) return res.status(404).json({ error: 'Item not found' });
        return res.status(200).json({ deleted: true, retired: true });
      }
      const result = await sql`
        DELETE FROM checklist_items
        WHERE id = ${id as string} AND company_id = ${admin.companyId}
        RETURNING id
      `;
      if (result.length === 0) return res.status(404).json({ error: 'Item not found' });
      return res.status(200).json({ deleted: true });
    } catch (error: any) {
      console.error('[API] Error:', error.message);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
