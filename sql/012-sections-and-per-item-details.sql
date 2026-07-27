-- Per-view sectioning for checklist items + per-item photos and notes.
-- Sections allowed: front, rear, sides, top, underbody, cabin, cargo, documents, supplies
ALTER TABLE checklist_items
  ADD COLUMN IF NOT EXISTS section TEXT NOT NULL DEFAULT 'cabin';

ALTER TABLE inspection_results ADD COLUMN IF NOT EXISTS photo_urls TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE inspection_results ADD COLUMN IF NOT EXISTS notes TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_checklist_items_section ON checklist_items(section);

-- =========================================================================
-- Car & E-Van daily
-- =========================================================================

-- Front: engine, headlights, turn signals, front camera
UPDATE checklist_items SET section = 'front'
WHERE frequency = 'daily' AND vehicle_type IN ('car','e_van')
  AND item_name_en IN (
    'Engine (Breakdown)',
    'Parking/head lights',
    'Turn signal/hazard lights',
    'Front/cabin camera',
    'Charging cable & port'
  );

-- Rear: rear lights, reverse sensor, rear camera, tailgate
UPDATE checklist_items SET section = 'rear'
WHERE frequency = 'daily' AND vehicle_type IN ('car','e_van')
  AND item_name_en IN (
    'Reverse sensor',
    'Rear camera',
    'Rear parking lights',
    'Reverse/brake lights',
    'Others (Tailgate)'
  );

-- Sides: doors, side mirrors, power windows, body & logo
UPDATE checklist_items SET section = 'sides'
WHERE frequency = 'daily' AND vehicle_type IN ('car','e_van')
  AND item_name_en IN (
    'Vehicle doors',
    'Side mirrors',
    'Power windows',
    'Body/DHL logo & text'
  );

-- Top: cargo height indicator
UPDATE checklist_items SET section = 'top'
WHERE frequency = 'daily' AND vehicle_type IN ('car','e_van')
  AND item_name_en = 'Cargo height indicator lights';

-- Underbody
UPDATE checklist_items SET section = 'underbody'
WHERE frequency = 'daily' AND vehicle_type IN ('car','e_van')
  AND item_name_en IN ('Underbody (oil leaks)','Underbody (fluid leaks)');

-- Cargo box
UPDATE checklist_items SET section = 'cargo'
WHERE frequency = 'daily' AND vehicle_type IN ('car','e_van')
  AND item_name_en IN (
    'Body/cargo box damage',
    'Cargo box 7-point check',
    'Cargo door lock & sensor',
    'Cargo/goods',
    'Cargo box cleanliness'
  );

-- Documents
UPDATE checklist_items SET section = 'documents'
WHERE frequency = 'daily' AND vehicle_type IN ('car','e_van')
  AND item_name_en IN (
    'Flyer (Standard & Large)',
    'Packing list Envelope',
    '3 PLY Waybill',
    'Performa Invoice',
    'SI Label',
    'TDX Label (Pre 9, 10:30, 12)',
    'Exception Card',
    'Courier Notification Card'
  );

-- Supplies (tape, envelopes, boxes, trolley)
UPDATE checklist_items SET section = 'supplies'
WHERE frequency = 'daily' AND vehicle_type IN ('car','e_van')
  AND (
    item_name_en IN (
      'OPP Tape','Paper Envelope','Trolley','Supplies arrangement'
    )
    OR item_name_en LIKE 'Box no.%'
    OR item_name_en LIKE 'Brown box%'
  );

-- Cabin: everything remaining interior-related
UPDATE checklist_items SET section = 'cabin'
WHERE frequency = 'daily' AND vehicle_type IN ('car','e_van')
  AND item_name_en IN (
    'Cleanliness & 5S inside and outside',
    'Seat belt',
    'Fuel/gas level',
    'Battery level / charge status',
    'Rear-view mirror',
    'Brakes (foot/hand)',
    'Warning lights',
    'Dashboard warning lights',
    'Horn',
    'Console area',
    'Front seats (both sides)',
    'Under front seats (both sides)',
    'Behind driver/passenger seats',
    'Interior lights',
    'Hand brake',
    'Tank'
  );

-- =========================================================================
-- Car & E-Van weekly
-- =========================================================================
UPDATE checklist_items SET section = 'cabin'
WHERE frequency = 'weekly' AND vehicle_type IN ('car','e_van')
  AND item_name_en IN ('Fire extinguisher','Air conditioning system');

UPDATE checklist_items SET section = 'front'
WHERE frequency = 'weekly' AND vehicle_type IN ('car','e_van')
  AND item_name_en IN ('Windshield wipers','Charging cable condition');

UPDATE checklist_items SET section = 'sides'
WHERE frequency = 'weekly' AND vehicle_type IN ('car','e_van')
  AND item_name_en = 'Tyre tread/pressure';

-- =========================================================================
-- Motorcycle daily
-- =========================================================================
UPDATE checklist_items SET section = 'front'
WHERE frequency = 'daily' AND vehicle_type = 'motorcycle'
  AND item_name_en IN ('Headlight','Turn signals','Horn','Rear-view mirror');

UPDATE checklist_items SET section = 'rear'
WHERE frequency = 'daily' AND vehicle_type = 'motorcycle'
  AND item_name_en IN ('Tail light','License plate');

UPDATE checklist_items SET section = 'sides'
WHERE frequency = 'daily' AND vehicle_type = 'motorcycle'
  AND item_name_en IN ('Tyres','General condition');

UPDATE checklist_items SET section = 'cargo'
WHERE frequency = 'daily' AND vehicle_type = 'motorcycle'
  AND item_name_en = 'Bike Box';

UPDATE checklist_items SET section = 'supplies'
WHERE frequency = 'daily' AND vehicle_type = 'motorcycle'
  AND item_name_en IN ('Helmet','OPP Tape','Paper Envelope');

UPDATE checklist_items SET section = 'documents'
WHERE frequency = 'daily' AND vehicle_type = 'motorcycle'
  AND item_name_en IN (
    'Flyer (Standard & Large)',
    'Packing list Envelope',
    '3 PLY Waybill',
    'Performa Invoice',
    'SI Label',
    'TDX Label (Pre 9, 10:30, 12)',
    'Exception Card',
    'Courier Notification Card'
  );

-- =========================================================================
-- Motorcycle weekly
-- =========================================================================
UPDATE checklist_items SET section = 'underbody'
WHERE frequency = 'weekly' AND vehicle_type = 'motorcycle'
  AND item_name_en IN ('Engine oil level','Chain/belt','Brake pads');

UPDATE checklist_items SET section = 'sides'
WHERE frequency = 'weekly' AND vehicle_type = 'motorcycle'
  AND item_name_en = 'Tyre tread/pressure';

UPDATE checklist_items SET section = 'cargo'
WHERE frequency = 'weekly' AND vehicle_type = 'motorcycle'
  AND item_name_en = 'Bike Box condition';
