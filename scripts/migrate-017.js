const { neon } = require('@neondatabase/serverless');
const { requireConfirmedTarget } = require('./lib/db-target');

const dryRun = process.argv.includes('--dry-run');

(async () => {
  const { url } = requireConfirmedTarget({
    action: 'apply migration 017 (vehicle_usable, activity log, region, maintenance)',
    dryRun,
  });
  if (dryRun) {
    console.log('Dry run: migration 017 not applied.');
    process.exit(0);
  }
  const sql = neon(url);

  await sql`ALTER TABLE inspection_logs ADD COLUMN IF NOT EXISTS vehicle_usable BOOLEAN`;
  console.log('✓ inspection_logs.vehicle_usable added');

  await sql`CREATE TABLE IF NOT EXISTS vehicle_activity_log (
    activity_date DATE NOT NULL,
    vehicle_id UUID NOT NULL REFERENCES vehicle_master(id) ON DELETE CASCADE,
    PRIMARY KEY (activity_date, vehicle_id)
  )`;
  await sql`CREATE INDEX IF NOT EXISTS idx_vehicle_activity_date ON vehicle_activity_log (activity_date)`;
  console.log('✓ vehicle_activity_log created');

  await sql`ALTER TABLE vehicle_master ADD COLUMN IF NOT EXISTS region TEXT NOT NULL DEFAULT 'metro'`;
  await sql`ALTER TABLE vehicle_master DROP CONSTRAINT IF EXISTS vehicle_master_region_check`;
  await sql`ALTER TABLE vehicle_master ADD CONSTRAINT vehicle_master_region_check
    CHECK (region IN ('metro', 'provincial'))`;
  console.log('✓ vehicle_master.region added');

  await sql`CREATE TABLE IF NOT EXISTS vehicle_maintenance (
    vehicle_id UUID PRIMARY KEY REFERENCES vehicle_master(id) ON DELETE CASCADE,
    last_service_date DATE,
    last_service_mileage INTEGER,
    last_tire_change_date DATE,
    last_tire_change_mileage INTEGER,
    last_battery_change_date DATE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`;
  console.log('✓ vehicle_maintenance created');

  console.log('Migration 017 complete.');
  process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });
