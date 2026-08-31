-- Migration 024: checklist fields present in the July/August legacy export.
-- Keep these items in both car and E-Van groups so source results remain
-- addressable after the wide spreadsheet is normalized.

INSERT INTO checklist_items (company_id, vehicle_type, frequency, item_name_th, item_name_en, sort_order, section)
SELECT c.id, v.vehicle_type, f.frequency, x.item_name_th, x.item_name_en, x.sort_order, x.section
FROM companies c
CROSS JOIN (VALUES ('car'::text), ('e_van'::text)) AS v(vehicle_type)
CROSS JOIN (VALUES ('daily'::text, 'ระบบกระจกไฟฟ้าห้องโดยสาร', 'Power windows', 57, 'cabin'::text)) AS f(frequency, item_name_th, item_name_en, sort_order, section)
CROSS JOIN (VALUES ('ระบบกระจกไฟฟ้าห้องโดยสาร', 'Power windows', 57, 'cabin'::text)) AS x(item_name_th, item_name_en, sort_order, section)
WHERE c.slug = 'dhl'
  AND v.vehicle_type = 'e_van'
  AND NOT EXISTS (
    SELECT 1 FROM checklist_items i
    WHERE i.company_id = c.id AND i.vehicle_type = v.vehicle_type
      AND i.frequency = f.frequency AND i.item_name_th = x.item_name_th
  );

INSERT INTO checklist_items (company_id, vehicle_type, frequency, item_name_th, item_name_en, sort_order, section)
SELECT c.id, v.vehicle_type, 'weekly', x.item_name_th, x.item_name_en, x.sort_order, x.section
FROM companies c
CROSS JOIN (VALUES ('car'::text), ('e_van'::text)) AS v(vehicle_type)
CROSS JOIN (VALUES
  ('ยางอะไหล่และเครื่องมือ', 'Spare tyre and tools', 6, 'cargo'::text),
  ('ระดับน้ำฉีดกระจก', 'Windshield washer fluid level', 7, 'front'::text),
  ('ระดับน้ำมันเบรค', 'Brake fluid level', 8, 'front'::text)
) AS x(item_name_th, item_name_en, sort_order, section)
WHERE c.slug = 'dhl'
  AND NOT EXISTS (
    SELECT 1 FROM checklist_items i
    WHERE i.company_id = c.id AND i.vehicle_type = v.vehicle_type
      AND i.frequency = 'weekly' AND i.item_name_th = x.item_name_th
  );
