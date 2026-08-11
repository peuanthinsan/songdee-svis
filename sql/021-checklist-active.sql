-- Migration 021: retire checklist items without breaking inspection history.
ALTER TABLE checklist_items
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_checklist_items_active
  ON checklist_items(company_id, is_active, vehicle_type, frequency);
