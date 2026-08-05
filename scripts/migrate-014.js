const { neon } = require('@neondatabase/serverless');
const { requireConfirmedTarget } = require('./lib/db-target');

const dryRun = process.argv.includes('--dry-run');

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
  const url = requireConfirmedTarget({
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
