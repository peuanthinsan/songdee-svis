-- DHL dashboard feedback (July 2026), items 1-6 + preventive maintenance.

-- 1. Final checklist question: is the vehicle usable? Drives the Out of Service
--    card (replaces the provisional open-defect proxy). NULL = legacy inspections
--    submitted before this question existed.
ALTER TABLE inspection_logs ADD COLUMN IF NOT EXISTS vehicle_usable BOOLEAN;

-- 2. Daily telematics activity snapshots. A row means the vehicle's GPS was online
--    (running/stopped) at some point that Bangkok day. Populated by the dashboard and
--    unit-status APIs whenever they read the GPS sheet. Drives the Active donut and
--    the weekly donut denominator.
CREATE TABLE IF NOT EXISTS vehicle_activity_log (
  activity_date DATE NOT NULL,
  vehicle_id UUID NOT NULL REFERENCES vehicle_master(id) ON DELETE CASCADE,
  PRIMARY KEY (activity_date, vehicle_id)
);
CREATE INDEX IF NOT EXISTS idx_vehicle_activity_date ON vehicle_activity_log (activity_date);

-- 3. Branch region drives the tire-replacement interval:
--    metro (Bangkok + metropolitan) = 40,000 km, provincial = 30,000 km.
ALTER TABLE vehicle_master ADD COLUMN IF NOT EXISTS region TEXT NOT NULL DEFAULT 'metro';
ALTER TABLE vehicle_master DROP CONSTRAINT IF EXISTS vehicle_master_region_check;
ALTER TABLE vehicle_master ADD CONSTRAINT vehicle_master_region_check
  CHECK (region IN ('metro', 'provincial'));

-- 4. Preventive-maintenance baselines, entered by admins. Projections combine these
--    with mileage recorded on every inspection (inspection_logs.mileage).
CREATE TABLE IF NOT EXISTS vehicle_maintenance (
  vehicle_id UUID PRIMARY KEY REFERENCES vehicle_master(id) ON DELETE CASCADE,
  last_service_date DATE,
  last_service_mileage INTEGER,
  last_tire_change_date DATE,
  last_tire_change_mileage INTEGER,
  last_battery_change_date DATE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
