-- Add new vehicle categories while preserving the existing `car` key.
-- `car` is displayed as Pickup for backwards compatibility with existing records.

ALTER TABLE vehicle_master DROP CONSTRAINT IF EXISTS vehicle_master_vehicle_type_check;
ALTER TABLE vehicle_master ADD CONSTRAINT vehicle_master_vehicle_type_check
  CHECK (vehicle_type IN ('car', 'van', 'e_van', 'motorcycle', 'e_bike', 'light_truck', 'six_wheel_truck'));

ALTER TABLE checklist_items DROP CONSTRAINT IF EXISTS checklist_items_vehicle_type_check;
ALTER TABLE checklist_items ADD CONSTRAINT checklist_items_vehicle_type_check
  CHECK (vehicle_type IN ('car', 'van', 'e_van', 'motorcycle', 'e_bike', 'light_truck', 'six_wheel_truck'));

-- New truck categories use the existing pickup checklist until truck-specific
-- inspection items are defined. Copy sections/details where available.
INSERT INTO checklist_items (vehicle_type, frequency, item_name_th, item_name_en, sort_order, section)
SELECT 'light_truck', frequency, item_name_th, item_name_en, sort_order, section
FROM checklist_items source
WHERE source.vehicle_type = 'car'
  AND NOT EXISTS (
    SELECT 1 FROM checklist_items existing
    WHERE existing.vehicle_type = 'light_truck'
  );

INSERT INTO checklist_items (vehicle_type, frequency, item_name_th, item_name_en, sort_order, section)
SELECT 'six_wheel_truck', frequency, item_name_th, item_name_en, sort_order, section
FROM checklist_items source
WHERE source.vehicle_type = 'car'
  AND NOT EXISTS (
    SELECT 1 FROM checklist_items existing
    WHERE existing.vehicle_type = 'six_wheel_truck'
  );
