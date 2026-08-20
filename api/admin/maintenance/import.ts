import type { VercelRequest, VercelResponse } from '@vercel/node';
import { neon } from '@neondatabase/serverless';
import { requireAdmin } from '../../../lib/admin-auth';
import { isDateString } from '../../../lib/validate';

export const config = { api: { bodyParser: { sizeLimit: '5mb' } } };

type MaintenanceImportRow = {
  vehicleId?: string;
  plateNumber?: string;
  region?: string | null;
  lastServiceDate?: string | null;
  lastServiceMileage?: number | string | null;
  lastTireChangeDate?: string | null;
  lastTireChangeMileage?: number | string | null;
  lastBatteryChangeDate?: string | null;
  taxExpiryDate?: string | null;
};

const dateOrNull = (value: unknown) => value === '' || value === null || value === undefined ? null : isDateString(value) ? value : undefined;
const kmOrNull = (value: unknown) => value === '' || value === null || value === undefined ? null : Number.isInteger(Number(value)) && Number(value) >= 0 ? Math.floor(Number(value)) : undefined;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const rows = Array.isArray(req.body?.rows) ? req.body.rows as MaintenanceImportRow[] : [];
  if (rows.length === 0) return res.status(400).json({ error: 'No maintenance rows provided' });
  if (rows.length > 1000) return res.status(400).json({ error: 'A file can contain at most 1000 rows' });

  try {
    const sql = neon(process.env.DATABASE_URL!);
    const vehicles = await sql`SELECT id, plate_number FROM vehicle_master WHERE company_id = ${admin.companyId}` as Array<{ id: string; plate_number: string }>;
    const byPlate = new Map(vehicles.map((vehicle) => [vehicle.plate_number.trim().toLowerCase(), vehicle]));
    const errors: string[] = [];
    const updates: Array<{ vehicleId: string; row: MaintenanceImportRow }> = [];

    rows.forEach((row, index) => {
      const vehicle = row.vehicleId ? vehicles.find((item) => item.id === row.vehicleId) : byPlate.get(String(row.plateNumber || '').trim().toLowerCase());
      if (!vehicle) { errors.push(`Row ${index + 2}: vehicle not found by plate number or vehicle ID`); return; }
      if (row.region !== undefined && row.region !== null && row.region !== 'metro' && row.region !== 'provincial') errors.push(`Row ${index + 2}: region must be metro or provincial`);
      for (const [label, value] of [['lastServiceDate', row.lastServiceDate], ['lastTireChangeDate', row.lastTireChangeDate], ['lastBatteryChangeDate', row.lastBatteryChangeDate], ['taxExpiryDate', row.taxExpiryDate]] as const) if (dateOrNull(value) === undefined) errors.push(`Row ${index + 2}: ${label} must be YYYY-MM-DD`);
      for (const [label, value] of [['lastServiceMileage', row.lastServiceMileage], ['lastTireChangeMileage', row.lastTireChangeMileage]] as const) if (kmOrNull(value) === undefined) errors.push(`Row ${index + 2}: ${label} must be a whole number`);
      updates.push({ vehicleId: vehicle.id, row });
    });
    if (errors.length) return res.status(400).json({ error: 'Import validation failed', errors: errors.slice(0, 20) });

    const queries: any[] = [];
    for (const { vehicleId, row } of updates) {
      if (row.region !== undefined) queries.push(sql.query('UPDATE vehicle_master SET region = $1 WHERE id = $2 AND company_id = $3', [row.region || null, vehicleId, admin.companyId]));
      if (row.taxExpiryDate !== undefined) queries.push(sql.query('UPDATE vehicle_master SET tax_expiry_date = $1 WHERE id = $2 AND company_id = $3', [dateOrNull(row.taxExpiryDate), vehicleId, admin.companyId]));
      queries.push(sql.query(`
        INSERT INTO vehicle_maintenance (vehicle_id, company_id, last_service_date, last_service_mileage, last_tire_change_date, last_tire_change_mileage, last_battery_change_date, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        ON CONFLICT (vehicle_id) DO UPDATE SET last_service_date = EXCLUDED.last_service_date, last_service_mileage = EXCLUDED.last_service_mileage, last_tire_change_date = EXCLUDED.last_tire_change_date, last_tire_change_mileage = EXCLUDED.last_tire_change_mileage, last_battery_change_date = EXCLUDED.last_battery_change_date, updated_at = NOW()
      `, [vehicleId, admin.companyId, dateOrNull(row.lastServiceDate), kmOrNull(row.lastServiceMileage), dateOrNull(row.lastTireChangeDate), kmOrNull(row.lastTireChangeMileage), dateOrNull(row.lastBatteryChangeDate)]));
    }
    await sql.transaction(queries);
    return res.status(200).json({ imported: updates.length });
  } catch (error: any) {
    console.error('[API] Maintenance import error:', error.message);
    return res.status(400).json({ error: error.message || 'Import failed' });
  }
}
