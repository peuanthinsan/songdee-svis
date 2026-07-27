const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

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
