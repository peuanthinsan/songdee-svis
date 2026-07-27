const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

(async () => {
  const sql = neon(process.env.DATABASE_URL);

  await sql`ALTER TABLE vehicle_master ADD COLUMN IF NOT EXISTS vendor_email TEXT`;
  console.log('✓ vehicle_master.vendor_email added');

  await sql`ALTER TABLE issue_reports ADD COLUMN IF NOT EXISTS vendor_notified_at TIMESTAMPTZ`;
  console.log('✓ issue_reports.vendor_notified_at added');

  console.log('Migration 016 complete.');
  process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });
