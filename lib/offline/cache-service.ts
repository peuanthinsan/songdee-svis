import { getDb } from './database';

const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

export async function cacheVehicles(vehicles: any[]) {
  const db = await getDb();
  if (!db) return;
  const now = Date.now();
  for (const v of vehicles) {
    await db.runAsync(
      'INSERT OR REPLACE INTO cached_vehicles (id, data, updated_at) VALUES (?, ?, ?)',
      v.id, JSON.stringify(v), now
    );
  }
}

export async function getCachedVehicle(id: string): Promise<any | null> {
  const db = await getDb();
  if (!db) return null;
  const row = await db.getFirstAsync<{ data: string; updated_at: number }>(
    'SELECT data, updated_at FROM cached_vehicles WHERE id = ?', id
  );
  if (!row) return null;
  if (Date.now() - row.updated_at > CACHE_TTL) return null;
  return JSON.parse(row.data);
}

export async function getCachedVehicles(fleetId?: string): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];
  const cutoff = Date.now() - CACHE_TTL;
  const rows = await db.getAllAsync<{ data: string }>(
    'SELECT data FROM cached_vehicles WHERE updated_at > ?', cutoff
  );
  const vehicles = rows.map(r => JSON.parse(r.data));
  if (fleetId) return vehicles.filter(v => v.fleet_id === fleetId);
  return vehicles;
}

export async function cacheChecklist(vehicleType: string, frequency: string, items: any[]) {
  const db = await getDb();
  if (!db) return;
  const key = `${vehicleType}:${frequency}`;
  await db.runAsync(
    'INSERT OR REPLACE INTO cached_checklist (key, data, updated_at) VALUES (?, ?, ?)',
    key, JSON.stringify(items), Date.now()
  );
}

export async function getCachedChecklist(vehicleType: string, frequency: string): Promise<any[] | null> {
  const db = await getDb();
  if (!db) return null;
  const key = `${vehicleType}:${frequency}`;
  const row = await db.getFirstAsync<{ data: string; updated_at: number }>(
    'SELECT data, updated_at FROM cached_checklist WHERE key = ?', key
  );
  if (!row) return null;
  if (Date.now() - row.updated_at > CACHE_TTL) return null;
  return JSON.parse(row.data);
}
