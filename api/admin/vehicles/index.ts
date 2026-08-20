import type { VercelRequest, VercelResponse } from '@vercel/node';
import { neon } from '@neondatabase/serverless';
import { requireAdmin } from '../../../lib/admin-auth';
import { isDateString } from '../../../lib/validate';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const sql = neon(process.env.DATABASE_URL!);

  if (req.method === 'GET') {
    try {
      const { fleetId, search } = req.query;
      const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
      const offset = parseInt(req.query.offset as string) || 0;
      let vehicles;
      if (fleetId && search) {
        const pattern = `%${search as string}%`;
        vehicles = await sql`
          SELECT id, plate_number, vehicle_type, fleet_id, fleet_manager_email, vendor_email, tax_expiry_date, created_at
          FROM vehicle_master
          WHERE company_id = ${admin.companyId}
            AND fleet_id = ${fleetId as string}
            AND (plate_number ILIKE ${pattern} OR vendor_email ILIKE ${pattern})
          ORDER BY plate_number, id
          LIMIT ${limit} OFFSET ${offset}
        `;
      } else if (fleetId) {
        vehicles = await sql`
          SELECT id, plate_number, vehicle_type, fleet_id, fleet_manager_email, vendor_email, tax_expiry_date, created_at
          FROM vehicle_master
          WHERE company_id = ${admin.companyId} AND fleet_id = ${fleetId as string}
          ORDER BY plate_number, id
          LIMIT ${limit} OFFSET ${offset}
        `;
      } else if (search) {
        const pattern = `%${search as string}%`;
        vehicles = await sql`
          SELECT id, plate_number, vehicle_type, fleet_id, fleet_manager_email, vendor_email, tax_expiry_date, created_at
          FROM vehicle_master
          WHERE company_id = ${admin.companyId}
            AND (plate_number ILIKE ${pattern} OR fleet_id ILIKE ${pattern} OR vendor_email ILIKE ${pattern})
          ORDER BY fleet_id, plate_number, id
          LIMIT ${limit} OFFSET ${offset}
        `;
      } else {
        vehicles = await sql`
          SELECT id, plate_number, vehicle_type, fleet_id, fleet_manager_email, vendor_email, tax_expiry_date, created_at
          FROM vehicle_master
          WHERE company_id = ${admin.companyId}
          ORDER BY fleet_id, plate_number, id
          LIMIT ${limit} OFFSET ${offset}
        `;
      }
      return res.status(200).json(vehicles);
    } catch (error: any) {
      console.error('[API] Error:', error.message);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  if (req.method === 'POST') {
    const { plateNumber, vehicleType, fleetId, fleetManagerEmail, vendorEmail, taxExpiryDate } = req.body;
    if (!plateNumber || !vehicleType || !fleetId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const VALID_TYPES = ['car', 'van', 'e_van', 'motorcycle', 'e_bike'];
    if (!VALID_TYPES.includes(vehicleType)) {
      return res.status(400).json({ error: 'Invalid vehicle type' });
    }
    if (taxExpiryDate !== undefined && taxExpiryDate !== null && !isDateString(taxExpiryDate)) {
      return res.status(400).json({ error: 'Invalid tax expiry date' });
    }
    try {
      const [vehicle] = await sql`
        INSERT INTO vehicle_master (plate_number, vehicle_type, fleet_id, company_id, fleet_manager_email, vendor_email, tax_expiry_date)
        VALUES (${plateNumber}, ${vehicleType}, ${fleetId}, ${admin.companyId}, ${fleetManagerEmail || null}, ${vendorEmail || null}, ${taxExpiryDate || null})
        RETURNING id, plate_number, vehicle_type, fleet_id, fleet_manager_email, vendor_email, tax_expiry_date
      `;
      return res.status(201).json(vehicle);
    } catch (error: any) {
      if (error.message?.includes('unique')) {
        return res.status(409).json({ error: 'Plate number already exists' });
      }
      console.error('[API] Error:', error.message);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
