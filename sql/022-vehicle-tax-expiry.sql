-- Migration 022: store the annual vehicle tax/sticker expiry date.
ALTER TABLE vehicle_master
  ADD COLUMN IF NOT EXISTS tax_expiry_date DATE;

CREATE INDEX IF NOT EXISTS idx_vehicle_master_tax_expiry
  ON vehicle_master(company_id, tax_expiry_date)
  WHERE is_active;
