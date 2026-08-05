const { neon } = require('@neondatabase/serverless');
const { requireConfirmedTarget } = require('./lib/db-target');

const dryRun = process.argv.includes('--dry-run');

(async () => {
  const { url } = requireConfirmedTarget({
    action: 'apply migration 016 (vendor_email, vendor_notified_at)',
    dryRun,
  });
  if (dryRun) {
    console.log('Dry run: migration 016 not applied.');
    process.exit(0);
  }
  const sql = neon(url);

  await sql`ALTER TABLE vehicle_master ADD COLUMN IF NOT EXISTS vendor_email TEXT`;
  console.log('✓ vehicle_master.vendor_email added');

  await sql`ALTER TABLE issue_reports ADD COLUMN IF NOT EXISTS vendor_notified_at TIMESTAMPTZ`;
  console.log('✓ issue_reports.vendor_notified_at added');

  console.log('Migration 016 complete.');
  process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });
