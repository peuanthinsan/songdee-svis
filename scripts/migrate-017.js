const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

(async () => {
  const sql = neon(process.env.DATABASE_URL);

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
