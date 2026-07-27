-- Allow e_van vehicle type in checklist_items
ALTER TABLE checklist_items DROP CONSTRAINT IF EXISTS checklist_items_vehicle_type_check;
ALTER TABLE checklist_items ADD CONSTRAINT checklist_items_vehicle_type_check
  CHECK (vehicle_type IN ('car', 'e_van', 'motorcycle'));
