import type { VercelRequest, VercelResponse } from '@vercel/node';
import { neon } from '@neondatabase/serverless';
import ExcelJS from 'exceljs';
import { requireAdmin } from '../../../lib/admin-auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const sql = neon(process.env.DATABASE_URL!);
    const rows = await sql`
      SELECT v.id AS vehicle_id, v.plate_number, v.fleet_id, v.vehicle_type, v.region,
        v.tax_expiry_date, m.last_service_date, m.last_service_mileage,
        m.last_tire_change_date, m.last_tire_change_mileage, m.last_battery_change_date
      FROM vehicle_master v
      LEFT JOIN vehicle_maintenance m ON m.vehicle_id = v.id
      WHERE v.company_id = ${admin.companyId}
      ORDER BY v.plate_number, v.id
    `;

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Maintenance');
    sheet.columns = [
      { header: 'Vehicle ID', key: 'vehicle_id', width: 38 },
      { header: 'Plate Number', key: 'plate_number', width: 18 },
      { header: 'Fleet', key: 'fleet_id', width: 14 },
      { header: 'Vehicle Type', key: 'vehicle_type', width: 16 },
      { header: 'Region', key: 'region', width: 14 },
      { header: 'Last Service Date', key: 'last_service_date', width: 18 },
      { header: 'Last Service Mileage', key: 'last_service_mileage', width: 20 },
      { header: 'Last Tire Change Date', key: 'last_tire_change_date', width: 21 },
      { header: 'Last Tire Change Mileage', key: 'last_tire_change_mileage', width: 23 },
      { header: 'Last Battery Change Date', key: 'last_battery_change_date', width: 24 },
      { header: 'Tax Expiry Date', key: 'tax_expiry_date', width: 18 },
    ];
    sheet.getRow(1).font = { bold: true };
    for (const row of rows) sheet.addRow(row);

    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="maintenance.xlsx"');
    return res.status(200).send(Buffer.from(buffer));
  } catch (error: any) {
    console.error('[API] Maintenance export error:', error.message);
    return res.status(500).json({ error: 'Export failed' });
  }
}
