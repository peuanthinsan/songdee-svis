const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

/*
 * This is a historical, one-shot migration. It must run in numeric order with
 * the other scripts/migrate-*.js files, not on its own against an arbitrary
 * database state.
 *
 * The `ON CONFLICT (key)` below is correct at this point in the sequence,
 * because this same script is the one that creates app_settings with `key`
 * as the single-column PRIMARY KEY. Later, migration 019 (sql/019-multi-company-svis.sql)
 * drops that primary key and replaces it with the composite (company_id, key).
 *
 * Do NOT re-run this script against a database that has already run 019 —
 * `ON CONFLICT (key)` will no longer match any unique constraint and Postgres
 * will raise error 42P10. Do NOT "fix" this to `ON CONFLICT (company_id, key)`
 * either: at the moment 014 runs, the company_id column does not exist yet,
 * and 019 itself depends on 014 having already created the app_settings table.
 * This comment exists so the next reader does not mistake this for the same
 * kind of ON CONFLICT mismatch found in scripts/seed-db.js and
 * scripts/seed-users-postgres.js, which target a single column against the
 * same post-019 composite keys. There, it is a real bug, because those
 * scripts are idempotent seeders meant to be re-run against the current head
 * schema. Here it is not a bug: this file is a one-shot ordered migration,
 * so the single-column ON CONFLICT target is correct for the schema state
 * at the time it runs. Do not "fix" it into something that breaks
 * fresh-environment bootstrap.
 */
async function safe(label, fn) {
  try {
    await fn();
    console.log('✓', label);
  } catch (e) {
    const msg = e.message || '';
    if (msg.includes('already exists') || msg.includes('duplicate')) {
      console.log('= already applied:', label);
    } else {
      throw e;
    }
  }
}

(async () => {
  const sql = neon(process.env.DATABASE_URL);

  await safe('create app_settings table', () => sql`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL DEFAULT '',
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await safe('seed unit_status_sheet_url', () => sql`
    INSERT INTO app_settings (key, value)
    VALUES ('unit_status_sheet_url', '')
    ON CONFLICT (key) DO NOTHING
  `);

  console.log('Migration 014 complete.');
  process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });
