-- Migration 015: Add 'van' as a distinct vehicle type
-- DHL fleet has four types: car (sedan/compact), van (delivery van), e_van, motorcycle

ALTER TABLE vehicle_master DROP CONSTRAINT IF EXISTS vehicle_master_vehicle_type_check;
ALTER TABLE vehicle_master ADD CONSTRAINT vehicle_master_vehicle_type_check
  CHECK (vehicle_type IN ('car', 'van', 'e_van', 'motorcycle'));

ALTER TABLE checklist_items DROP CONSTRAINT IF EXISTS checklist_items_vehicle_type_check;
ALTER TABLE checklist_items ADD CONSTRAINT checklist_items_vehicle_type_check
  CHECK (vehicle_type IN ('car', 'van', 'e_van', 'motorcycle'));
