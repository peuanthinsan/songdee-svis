import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;
let initPromise: Promise<SQLite.SQLiteDatabase | null> | null = null;
let initFailed = false;

export async function getDb(): Promise<SQLite.SQLiteDatabase | null> {
  if (initFailed) return null;
  if (db) return db;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const database = await SQLite.openDatabaseAsync('svis-offline');
      await database.execAsync(
        `CREATE TABLE IF NOT EXISTS cached_vehicles (
          id TEXT PRIMARY KEY,
          data TEXT NOT NULL,
          updated_at INTEGER NOT NULL
        )`
      );
      await database.execAsync(
        `CREATE TABLE IF NOT EXISTS cached_checklist (
          key TEXT PRIMARY KEY,
          data TEXT NOT NULL,
          updated_at INTEGER NOT NULL
        )`
      );
      await database.execAsync(
        `CREATE TABLE IF NOT EXISTS pending_inspections (
          id TEXT PRIMARY KEY,
          payload TEXT NOT NULL,
          photo_uris TEXT NOT NULL DEFAULT '[]',
          status TEXT NOT NULL DEFAULT 'pending',
          error TEXT,
          created_at INTEGER NOT NULL,
          attempts INTEGER NOT NULL DEFAULT 0
        )`
      );
      db = database;
      return database;
    } catch (err) {
      console.warn('[Offline] SQLite not available, offline features disabled:', err);
      initFailed = true;
      initPromise = null;
      return null;
    }
  })();

  return initPromise;
}
