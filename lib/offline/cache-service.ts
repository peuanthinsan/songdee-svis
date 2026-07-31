import { getDb } from './database';

const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

function scopedKey(companyScope: string, key: string): string {
  return `${companyScope}:${key}`;
}

function bangkokDayStart(): number {
  const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;
  const bangkokNow = new Date(Date.now() + BANGKOK_OFFSET_MS);
  bangkokNow.setUTCHours(0, 0, 0, 0);
  return bangkokNow.getTime() - BANGKOK_OFFSET_MS;
}

function bangkokWeekStart(): number {
  const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;
  const bangkokNow = new Date(Date.now() + BANGKOK_OFFSET_MS);
  const daysSinceMonday = (bangkokNow.getUTCDay() + 6) % 7;
  bangkokNow.setUTCDate(bangkokNow.getUTCDate() - daysSinceMonday);
  bangkokNow.setUTCHours(0, 0, 0, 0);
  return bangkokNow.getTime() - BANGKOK_OFFSET_MS;
}

export async function cacheVehicles(companyScope: string, vehicles: any[]) {
  const db = await getDb();
  if (!db) return;
  const now = Date.now();
  await db.withTransactionAsync(async () => {
    for (const vehicle of vehicles) {
      await db.runAsync(
        'INSERT OR REPLACE INTO cached_vehicles (id, data, updated_at) VALUES (?, ?, ?)',
        scopedKey(companyScope, vehicle.id), JSON.stringify(vehicle), now
      );
    }
  });
}

export async function getCachedVehicle(
  companyScope: string,
  id: string,
  fleetScope?: string
): Promise<any | null> {
  const db = await getDb();
  if (!db) return null;
  const row = await db.getFirstAsync<{ data: string; updated_at: number }>(
    'SELECT data, updated_at FROM cached_vehicles WHERE id = ?',
    scopedKey(companyScope, id)
  );
  if (!row) return null;
  if (Date.now() - row.updated_at > CACHE_TTL) return null;
  const vehicle = JSON.parse(row.data);
  if (fleetScope !== undefined && vehicle.fleet_id !== fleetScope) return null;
  return vehicle;
}

export async function getCachedVehicles(companyScope: string, fleetId?: string): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];
  const cutoff = Date.now() - CACHE_TTL;
  const rows = await db.getAllAsync<{ data: string; updated_at: number }>(
    'SELECT data, updated_at FROM cached_vehicles WHERE id LIKE ? AND updated_at > ?',
    `${companyScope}:%`, cutoff
  );
  const todayStart = bangkokDayStart();
  const weekStart = bangkokWeekStart();
  const vehicles = rows.map((row) => {
    const vehicle = JSON.parse(row.data);
    return {
      ...vehicle,
      ...(row.updated_at < todayStart ? {
        today_status: 'pending',
        daily_status: 'pending',
        daily_result: undefined,
        daily_checked_by: undefined,
        checked_by: undefined,
      } : {}),
      ...(row.updated_at < weekStart ? {
        weekly_status: 'pending',
      } : {}),
    };
  }).sort((a, b) => (
    String(a.fleet_id).localeCompare(String(b.fleet_id))
    || String(a.plate_number).localeCompare(String(b.plate_number))
  ));
  if (fleetId !== undefined) return vehicles.filter(v => v.fleet_id === fleetId);
  return vehicles;
}

export async function cacheChecklist(
  companyScope: string,
  vehicleType: string,
  frequency: string,
  items: any[]
) {
  const db = await getDb();
  if (!db) return;
  const key = scopedKey(companyScope, `${vehicleType}:${frequency}`);
  await db.runAsync(
    'INSERT OR REPLACE INTO cached_checklist (key, data, updated_at) VALUES (?, ?, ?)',
    key, JSON.stringify(items), Date.now()
  );
}

export async function getCachedChecklist(
  companyScope: string,
  vehicleType: string,
  frequency: string
): Promise<any[] | null> {
  const db = await getDb();
  if (!db) return null;
  const key = scopedKey(companyScope, `${vehicleType}:${frequency}`);
  const row = await db.getFirstAsync<{ data: string; updated_at: number }>(
    'SELECT data, updated_at FROM cached_checklist WHERE key = ?', key
  );
  if (!row) return null;
  if (Date.now() - row.updated_at > CACHE_TTL) return null;
  return JSON.parse(row.data);
}
