-- Allow 'post_route' as a third inspection frequency.
ALTER TABLE checklist_items DROP CONSTRAINT IF EXISTS checklist_items_frequency_check;
ALTER TABLE checklist_items ADD CONSTRAINT checklist_items_frequency_check
  CHECK (frequency IN ('daily', 'weekly', 'post_route'));

-- Mandatory mileage / odometer fields on every inspection.
ALTER TABLE inspection_logs ADD COLUMN IF NOT EXISTS mileage INTEGER;
ALTER TABLE inspection_logs ADD COLUMN IF NOT EXISTS odometer_photo_url TEXT;

-- Post Route checklist items.
-- Motorcycle (covers E-Bike per spec) — "Post Route: ทั่วไป"
INSERT INTO checklist_items (vehicle_type, frequency, item_name_th, item_name_en, sort_order, section) VALUES
  ('motorcycle', 'post_route', 'Bike Box', 'Bike Box', 1, 'cargo'),
  ('motorcycle', 'post_route', 'Supplies', 'Supplies', 2, 'supplies');

-- Car — "ด้านในห้องโดยสาร" (cabin) and "ด้านในตู้บรรทุก" (cargo)
INSERT INTO checklist_items (vehicle_type, frequency, item_name_th, item_name_en, sort_order, section) VALUES
  ('car', 'post_route', 'บนคอนโซลหน้า', 'Console area', 1, 'cabin'),
  ('car', 'post_route', 'บนเบาะหน้า 2 ด้าน', 'Front seats (both sides)', 2, 'cabin'),
  ('car', 'post_route', 'ใต้เบาะหน้า 2 ด้าน', 'Under front seats (both sides)', 3, 'cabin'),
  ('car', 'post_route', 'ด้านหลังเบาะคนขับและคนนั่ง', 'Behind driver/passenger seats', 4, 'cabin'),
  ('car', 'post_route', 'ไฟในรถ', 'Interior lights', 5, 'cabin'),
  ('car', 'post_route', 'เบรคมือ', 'Hand brake', 6, 'cabin'),
  ('car', 'post_route', 'สินค้า', 'Cargo/goods', 7, 'cargo'),
  ('car', 'post_route', 'การจัดเรียง Supplies', 'Supplies arrangement', 8, 'cargo'),
  ('car', 'post_route', 'ถัง', 'Tank', 9, 'cargo'),
  ('car', 'post_route', 'ความสะอาดภายในตู้บรรทุก', 'Cargo box cleanliness', 10, 'cargo');

-- E-Van — same Post Route items as car (per Excel "Sheet1" lease scope reference).
INSERT INTO checklist_items (vehicle_type, frequency, item_name_th, item_name_en, sort_order, section) VALUES
  ('e_van', 'post_route', 'บนคอนโซลหน้า', 'Console area', 1, 'cabin'),
  ('e_van', 'post_route', 'บนเบาะหน้า 2 ด้าน', 'Front seats (both sides)', 2, 'cabin'),
  ('e_van', 'post_route', 'ใต้เบาะหน้า 2 ด้าน', 'Under front seats (both sides)', 3, 'cabin'),
  ('e_van', 'post_route', 'ด้านหลังเบาะคนขับและคนนั่ง', 'Behind driver/passenger seats', 4, 'cabin'),
  ('e_van', 'post_route', 'ไฟในรถ', 'Interior lights', 5, 'cabin'),
  ('e_van', 'post_route', 'เบรคมือ', 'Hand brake', 6, 'cabin'),
  ('e_van', 'post_route', 'สินค้า', 'Cargo/goods', 7, 'cargo'),
  ('e_van', 'post_route', 'การจัดเรียง Supplies', 'Supplies arrangement', 8, 'cargo'),
  ('e_van', 'post_route', 'ถัง', 'Tank', 9, 'cargo'),
  ('e_van', 'post_route', 'ความสะอาดภายในตู้บรรทุก', 'Cargo box cleanliness', 10, 'cargo');
