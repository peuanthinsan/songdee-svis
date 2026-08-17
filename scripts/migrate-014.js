const { neon } = require('@neondatabase/serverless');
const { requireConfirmedTarget } = require('./lib/db-target');

const dryRun = process.argv.includes('--dry-run');

/*
 * This is a historical, one-shot migration. It must run in numeric order with
 * the other scripts/migrate-*.js files, not on its own against an arbitrary
 * database state.
 *
 * The `ON CONFLICT (key)` below is correct at this point in the sequence,
 * because this same script is the one that creates app_settings with `key`
 * as the single-column PRIMARY KEY. Later, migration 019
 * (sql/019-multi-company-svis.sql) drops that primary key and replaces it
 * with the composite (company_id, key).
 *
 * Do NOT re-run this script against a database that has already run 019:
 * `ON CONFLICT (key)` will no longer match any unique constraint and Postgres
 * will raise error 42P10. Do NOT "fix" this to `ON CONFLICT (company_id, key)`
 * either: at the moment 014 runs, the company_id column does not exist yet,
 * and 019 itself depends on 014 having already created the app_settings table.
 * This differs from current-schema seeders, which are intended to be re-run
 * and therefore must track the post-019 composite keys. Here the historical
 * single-column conflict target preserves fresh-environment bootstrap.
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
  const { url } = requireConfirmedTarget({
    action: 'apply migration 014 (app_settings table)',
    dryRun,
  });
  if (dryRun) {
    console.log('Dry run: migration 014 not applied.');
    process.exit(0);
  }
  const sql = neon(url);

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
