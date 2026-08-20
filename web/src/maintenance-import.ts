import { parseCsvMatrix } from './checklist-import';

export type MaintenanceImportRow = {
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

const aliases: Record<keyof MaintenanceImportRow, string[]> = {
  vehicleId: ['vehicle_id', 'vehicleid'], plateNumber: ['plate_number', 'platenumber', 'plate'], region: ['region'],
  lastServiceDate: ['last_service_date', 'lastservicedate'], lastServiceMileage: ['last_service_mileage', 'lastservicemileage'],
  lastTireChangeDate: ['last_tire_change_date', 'lasttirechangedate'], lastTireChangeMileage: ['last_tire_change_mileage', 'lasttirechangemileage'],
  lastBatteryChangeDate: ['last_battery_change_date', 'lastbatterychangedate'], taxExpiryDate: ['tax_expiry_date', 'taxexpirydate'],
};

function normalize(value: unknown) { return String(value ?? '').trim().toLowerCase().replace(/^\uFEFF/, '').replace(/[\s-]+/g, '_'); }
function value(row: readonly unknown[], index: number | undefined) { return index === undefined ? '' : String(row[index] ?? '').trim(); }
function dateValue(raw: string) { return raw ? raw.slice(0, 10) : null; }

export async function parseMaintenanceImportFile(file: File): Promise<MaintenanceImportRow[]> {
  const extension = file.name.toLowerCase().split('.').pop();
  const matrix = extension === 'csv'
    ? parseCsvMatrix(await file.text())
    : extension === 'xlsx'
      ? await (async () => { const { readSheet } = await import('read-excel-file/browser'); return readSheet(file); })()
      : null;
  if (!matrix) throw new Error('Choose a CSV or XLSX file');
  const headerIndex = matrix.findIndex((row) => row.some((cell) => String(cell ?? '').trim()));
  if (headerIndex < 0) throw new Error('The file is empty');
  const headers = matrix[headerIndex].map(normalize);
  const columns = Object.fromEntries((Object.keys(aliases) as Array<keyof MaintenanceImportRow>).map((key) => [key, aliases[key].map((alias) => headers.indexOf(alias)).find((index) => index >= 0)])) as Record<keyof MaintenanceImportRow, number | undefined>;
  if (columns.plateNumber === undefined && columns.vehicleId === undefined) throw new Error('Required column: Plate Number or Vehicle ID');
  const rows = matrix.slice(headerIndex + 1).filter((row) => row.some((cell) => String(cell ?? '').trim()));
  if (rows.length > 1000) throw new Error('A file can contain at most 1000 rows');
  return rows.map((row) => ({
    vehicleId: value(row, columns.vehicleId) || undefined,
    plateNumber: value(row, columns.plateNumber) || undefined,
    region: value(row, columns.region) || undefined,
    lastServiceDate: dateValue(value(row, columns.lastServiceDate)),
    lastServiceMileage: value(row, columns.lastServiceMileage) || null,
    lastTireChangeDate: dateValue(value(row, columns.lastTireChangeDate)),
    lastTireChangeMileage: value(row, columns.lastTireChangeMileage) || null,
    lastBatteryChangeDate: dateValue(value(row, columns.lastBatteryChangeDate)),
    taxExpiryDate: dateValue(value(row, columns.taxExpiryDate)),
  }));
}
