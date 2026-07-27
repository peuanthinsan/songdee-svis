-- Add frequency column to inspection_logs to distinguish daily vs weekly inspections
ALTER TABLE inspection_logs ADD COLUMN IF NOT EXISTS frequency TEXT NOT NULL DEFAULT 'daily';

-- Drop the old unique constraint and create a new one that includes frequency
ALTER TABLE inspection_logs DROP CONSTRAINT IF EXISTS inspection_logs_vehicle_id_inspection_date_key;
ALTER TABLE inspection_logs ADD CONSTRAINT inspection_logs_vehicle_freq_date_key
  UNIQUE(vehicle_id, inspection_date, frequency);

-- Backfill: mark existing inspections as 'daily' (they all are since frequency wasn't tracked)
UPDATE inspection_logs SET frequency = 'daily' WHERE frequency IS NULL;
