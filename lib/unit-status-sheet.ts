/**
 * Shared access to the telematics Google Sheet (unit_status_sheet_url setting).
 * Both /api/unit-status and /api/dashboard read GPS state from here; the dashboard
 * additionally derives the "Active" metric from it, so the fetching/parsing and the
 * daily activity-log recording live in one place.
 */

export type GpsStatus = 'running' | 'stopped' | 'offline';

export type SheetVehicle = {
  plateNumber: string;
  fleet: string;
  driverName: string;
  gpsStatus: GpsStatus;
  ignition: boolean;
  speed: number;
  lastFixTime: string;
  updatedAt: string;
};

type NeonSql = (strings: TemplateStringsArray, ...params: any[]) => Promise<any[]>;

/** Convert a Google Sheets edit URL to a CSV export URL. */
export function toSheetCsvUrl(url: string): string | null {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (!match) return null;
  const id = match[1];
  const gidMatch = url.match(/[#?&]gid=(\d+)/);
  const gid = gidMatch ? gidMatch[1] : '0';
  return `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`;
}

export function parseGpsStatus(raw: string): GpsStatus {
  const s = raw.trim().toLowerCase();
  if (s === 'running') return 'running';
  if (s === 'stop') return 'stopped';
  return 'offline';
}

async function fetchSheetCsv(csvUrl: string): Promise<string> {
  const res = await fetch(csvUrl, { redirect: 'follow' });
  if (!res.ok) throw new Error(`Sheet fetch failed: ${res.status}`);
  return res.text();
}

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split('\n').filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  return lines.slice(1).map(line => {
    const vals = line.split(',').map(v => v.trim().replace(/"/g, ''));
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = vals[i] ?? ''; });
    return row;
  });
}

/**
 * Read the configured sheet and return one entry per vehicle row.
 * Returns null when no sheet URL is configured; throws on an invalid URL
 * or fetch failure so callers can decide how to degrade.
 */
export async function fetchSheetVehicles(sql: NeonSql, companyId: string): Promise<SheetVehicle[] | null> {
  const settingsRows = await sql`
    SELECT value FROM app_settings
    WHERE key = 'unit_status_sheet_url' AND company_id = ${companyId}
  `;
  const sheetUrl = settingsRows[0]?.value?.trim() ?? '';
  if (!sheetUrl) return null;

  const csvUrl = toSheetCsvUrl(sheetUrl);
  if (!csvUrl) throw new Error('Invalid Google Sheets URL');

  const rows = parseCsv(await fetchSheetCsv(csvUrl));
  return rows
    .filter(r => r.VehicleNo)
    .map(r => ({
      plateNumber: r.VehicleNo.trim(),
      fleet: r.Fleet ?? '',
      driverName: r.DriverName ?? '',
      gpsStatus: parseGpsStatus(r.Status ?? ''),
      ignition: (r.Ignition ?? '').toUpperCase() === 'ON',
      speed: parseFloat(r.Speed ?? '0') || 0,
      lastFixTime: r.LastFixTime ?? '',
      updatedAt: r.UpdatedAt ?? '',
    }));
}

/**
 * Record today's GPS-online vehicles into vehicle_activity_log (idempotent upsert).
 * "Active" per client definition = telematics shows usage that day, i.e. the GPS
 * unit reported running/stopped rather than offline.
 */
export async function recordVehicleActivity(
  sql: NeonSql,
  vehicles: SheetVehicle[],
  today: string,
  companyId: string,
): Promise<void> {
  const activePlates = vehicles.filter(v => v.gpsStatus !== 'offline').map(v => v.plateNumber);
  if (activePlates.length === 0) return;
  await sql`
    INSERT INTO vehicle_activity_log (activity_date, vehicle_id, company_id)
    SELECT ${today}::date, v.id, ${companyId}::uuid
    FROM vehicle_master v
    WHERE v.company_id = ${companyId}
      AND v.plate_number = ANY(${activePlates}::text[])
    ON CONFLICT DO NOTHING
  `;
}
