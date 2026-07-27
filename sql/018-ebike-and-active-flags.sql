-- Migration 018: Add e-bike support and inactive-row infrastructure.

ALTER TABLE vehicle_master DROP CONSTRAINT IF EXISTS vehicle_master_vehicle_type_check;
ALTER TABLE vehicle_master ADD CONSTRAINT vehicle_master_vehicle_type_check
  CHECK (vehicle_type IN ('car', 'van', 'e_van', 'motorcycle', 'e_bike'));

ALTER TABLE checklist_items DROP CONSTRAINT IF EXISTS checklist_items_vehicle_type_check;
ALTER TABLE checklist_items ADD CONSTRAINT checklist_items_vehicle_type_check
  CHECK (vehicle_type IN ('car', 'van', 'e_van', 'motorcycle', 'e_bike'));

ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE vehicle_master ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- Vans use the existing car checklist. E-bikes use the motorcycle checklist.
-- Copy the section too, so the mobile inspection zones remain identical to the source.
INSERT INTO checklist_items (vehicle_type, frequency, item_name_th, item_name_en, sort_order, section)
SELECT 'van', frequency, item_name_th, item_name_en, sort_order, section
FROM checklist_items
WHERE vehicle_type = 'car'
  AND NOT EXISTS (SELECT 1 FROM checklist_items WHERE vehicle_type = 'van');

INSERT INTO checklist_items (vehicle_type, frequency, item_name_th, item_name_en, sort_order, section)
SELECT 'e_bike', frequency, item_name_th, item_name_en, sort_order, section
FROM checklist_items
WHERE vehicle_type = 'motorcycle'
  AND NOT EXISTS (SELECT 1 FROM checklist_items WHERE vehicle_type = 'e_bike');
