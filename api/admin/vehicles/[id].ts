import type { VercelRequest, VercelResponse } from '@vercel/node';
import { neon } from '@neondatabase/serverless';
import { requireAdmin } from '../../../lib/admin-auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const { id } = req.query;
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Vehicle ID required' });
  }

  const sql = neon(process.env.DATABASE_URL!);

  if (req.method === 'PUT') {
    const { plateNumber, vehicleType, fleetId, fleetManagerEmail, vendorEmail } = req.body;
    if (vehicleType && !['car', 'van', 'e_van', 'motorcycle', 'e_bike'].includes(vehicleType)) {
      return res.status(400).json({ error: 'Invalid vehicle type' });
    }
    try {
      const [vehicle] = await sql`
        UPDATE vehicle_master SET
          plate_number = COALESCE(${plateNumber || null}, plate_number),
          vehicle_type = COALESCE(${vehicleType || null}, vehicle_type),
          fleet_id = COALESCE(${fleetId || null}, fleet_id),
          fleet_manager_email = COALESCE(${fleetManagerEmail ?? null}, fleet_manager_email),
          vendor_email = COALESCE(${vendorEmail ?? null}, vendor_email)
        WHERE id = ${id} AND company_id = ${admin.companyId}
        RETURNING id, plate_number, vehicle_type, fleet_id, fleet_manager_email, vendor_email
      `;
      if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });
      return res.status(200).json(vehicle);
    } catch (error: any) {
      console.error('[API] Error:', error.message);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      // Check if vehicle has inspections
      const inspections = await sql`
        SELECT COUNT(*)::int as count FROM inspection_logs
        WHERE vehicle_id = ${id} AND company_id = ${admin.companyId}
      `;
      if (inspections[0].count > 0) {
        return res.status(409).json({ error: 'Cannot delete vehicle with inspection history' });
      }
      const result = await sql`
        DELETE FROM vehicle_master
        WHERE id = ${id} AND company_id = ${admin.companyId}
        RETURNING id
      `;
      if (result.length === 0) return res.status(404).json({ error: 'Vehicle not found' });
      return res.status(200).json({ deleted: true });
    } catch (error: any) {
      console.error('[API] Error:', error.message);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
