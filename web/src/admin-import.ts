import { parseCsvMatrix } from './checklist-import';

type RecordValue = string;

function normalize(value: unknown) {
  return String(value ?? '').trim().toLowerCase().replace(/^\uFEFF/, '').replace(/[\s-]+/g, '_');
}

async function readRows(file: File): Promise<Record<string, RecordValue>[]> {
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
  const rows = matrix.slice(headerIndex + 1).filter((row) => row.some((cell) => String(cell ?? '').trim()));
  if (rows.length > 1000) throw new Error('A file can contain at most 1000 rows');
  return rows.map((row) => Object.fromEntries(headers.map((header, index) => [header, String(row[index] ?? '').trim()])));
}

function pick(row: Record<string, string>, aliases: string[]) {
  for (const alias of aliases) if (row[alias] !== undefined) return row[alias];
  return '';
}

export async function parseVehicleImportFile(file: File) {
  const rows = await readRows(file);
  return rows.map((row, index) => ({
    rowNumber: index + 2,
    plateNumber: pick(row, ['plate_number', 'platenumber', 'plate', 'license_plate']),
    vehicleType: pick(row, ['vehicle_type', 'vehicletype', 'type']).toLowerCase(),
    fleetId: pick(row, ['fleet_id', 'fleet', 'service_center']),
    fleetManagerEmail: pick(row, ['fleet_manager_email', 'fleetmanageremail', 'manager_email']),
    vendorEmail: pick(row, ['vendor_email', 'vendoremail']),
    taxExpiryDate: pick(row, ['tax_expiry_date', 'taxexpirydate']),
  }));
}

export async function parseFleetImportFile(file: File) {
  const rows = await readRows(file);
  return rows.map((row, index) => ({
    rowNumber: index + 2,
    fleetId: pick(row, ['fleet_id', 'fleet', 'service_center']),
    fleetManagerEmail: pick(row, ['fleet_manager_email', 'fleetmanageremail', 'manager_email']),
  }));
}

export async function parseIssueImportFile(file: File) {
  const rows = await readRows(file);
  return rows.map((row, index) => ({
    rowNumber: index + 2,
    issueId: pick(row, ['issue_id', 'issueid', 'id']),
    status: pick(row, ['status', 'issue_status']).toLowerCase(),
  }));
}
