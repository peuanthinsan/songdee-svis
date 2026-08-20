import type { VercelRequest, VercelResponse } from '@vercel/node';
import { neon } from '@neondatabase/serverless';
import ExcelJS from 'exceljs';
import { requireAdmin } from '../../../lib/admin-auth';
import { vehicleTypeLabel } from '../../../lib/types';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const fleetId = typeof req.query.fleetId === 'string' ? req.query.fleetId.trim() : '';
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const pattern = `%${search}%`;

  try {
    const sql = neon(process.env.DATABASE_URL!);
    const vehicles = await sql`
      SELECT plate_number, vehicle_type, fleet_id, fleet_manager_email,
        vendor_email, tax_expiry_date, created_at
      FROM vehicle_master
      WHERE company_id = ${admin.companyId}
        AND (${fleetId || null}::text IS NULL OR fleet_id = ${fleetId})
        AND (${search || null}::text IS NULL OR plate_number ILIKE ${pattern} OR fleet_id ILIKE ${pattern} OR vendor_email ILIKE ${pattern})
      ORDER BY fleet_id, plate_number
    `;

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Vehicles');
    sheet.columns = [
      { header: 'Plate Number', key: 'plate_number', width: 18 },
      { header: 'Vehicle Type', key: 'vehicle_type', width: 16 },
      { header: 'Fleet', key: 'fleet_id', width: 16 },
      { header: 'Fleet Manager Email', key: 'fleet_manager_email', width: 28 },
      { header: 'Vendor Email', key: 'vendor_email', width: 28 },
      { header: 'Tax Expiry Date', key: 'tax_expiry_date', width: 18 },
      { header: 'Created At', key: 'created_at', width: 24 },
    ];
    sheet.getRow(1).font = { bold: true };
    for (const vehicle of vehicles) {
      sheet.addRow({
        ...vehicle,
        vehicle_type: vehicleTypeLabel(vehicle.vehicle_type),
        tax_expiry_date: vehicle.tax_expiry_date ? new Date(vehicle.tax_expiry_date).toLocaleDateString('en-GB') : '',
        created_at: vehicle.created_at ? new Date(vehicle.created_at).toLocaleString('en-GB') : '',
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="vehicles.xlsx"');
    return res.status(200).send(Buffer.from(buffer));
  } catch (error: any) {
    console.error('[API] Vehicle export error:', error.message);
    return res.status(500).json({ error: 'Export failed' });
  }
}
