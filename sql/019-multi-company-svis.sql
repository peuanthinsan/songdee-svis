-- SVIS multi-company foundation.
-- Existing production data is assigned to DHL, the first/default company.
BEGIN;

CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL CHECK (slug ~ '^[a-z0-9][a-z0-9-]*$'),
  name TEXT NOT NULL,
  short_name TEXT NOT NULL,
  primary_color TEXT NOT NULL DEFAULT '#06264B',
  accent_color TEXT NOT NULL DEFAULT '#00A6C8',
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO companies (id, slug, name, short_name, primary_color, accent_color, sort_order)
VALUES (
  '00000000-0000-4000-8000-000000000001',
  'dhl',
  'DHL Express',
  'DHL',
  '#FFCC00',
  '#D40511',
  0
)
ON CONFLICT (slug) DO UPDATE SET
  id = EXCLUDED.id,
  name = EXCLUDED.name,
  short_name = EXCLUDED.short_name,
  primary_color = EXCLUDED.primary_color,
  accent_color = EXCLUDED.accent_color,
  is_active = true;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS company_id UUID
  REFERENCES companies(id);
UPDATE users
SET company_id = '00000000-0000-4000-8000-000000000001'
WHERE company_id IS NULL;
ALTER TABLE users ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE users ALTER COLUMN company_id
  SET DEFAULT '00000000-0000-4000-8000-000000000001';

ALTER TABLE vehicle_master
  ADD COLUMN IF NOT EXISTS company_id UUID
  REFERENCES companies(id);
UPDATE vehicle_master
SET company_id = '00000000-0000-4000-8000-000000000001'
WHERE company_id IS NULL;
ALTER TABLE vehicle_master ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE vehicle_master ALTER COLUMN company_id
  SET DEFAULT '00000000-0000-4000-8000-000000000001';

ALTER TABLE checklist_items
  ADD COLUMN IF NOT EXISTS company_id UUID
  REFERENCES companies(id);
UPDATE checklist_items
SET company_id = '00000000-0000-4000-8000-000000000001'
WHERE company_id IS NULL;
ALTER TABLE checklist_items ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE checklist_items ALTER COLUMN company_id
  SET DEFAULT '00000000-0000-4000-8000-000000000001';

ALTER TABLE inspection_logs
  ADD COLUMN IF NOT EXISTS company_id UUID
  REFERENCES companies(id);
UPDATE inspection_logs il
SET company_id = vm.company_id
FROM vehicle_master vm
WHERE il.vehicle_id = vm.id AND il.company_id IS NULL;
ALTER TABLE inspection_logs ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE inspection_logs ALTER COLUMN company_id
  SET DEFAULT '00000000-0000-4000-8000-000000000001';

ALTER TABLE issue_reports
  ADD COLUMN IF NOT EXISTS company_id UUID
  REFERENCES companies(id);
UPDATE issue_reports ir
SET company_id = vm.company_id
FROM vehicle_master vm
WHERE ir.vehicle_id = vm.id AND ir.company_id IS NULL;
ALTER TABLE issue_reports ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE issue_reports ALTER COLUMN company_id
  SET DEFAULT '00000000-0000-4000-8000-000000000001';

ALTER TABLE vehicle_activity_log
  ADD COLUMN IF NOT EXISTS company_id UUID
  REFERENCES companies(id);
UPDATE vehicle_activity_log val
SET company_id = vm.company_id
FROM vehicle_master vm
WHERE val.vehicle_id = vm.id AND val.company_id IS NULL;
ALTER TABLE vehicle_activity_log ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE vehicle_activity_log ALTER COLUMN company_id
  SET DEFAULT '00000000-0000-4000-8000-000000000001';

ALTER TABLE vehicle_maintenance
  ADD COLUMN IF NOT EXISTS company_id UUID
  REFERENCES companies(id);
UPDATE vehicle_maintenance vma
SET company_id = vm.company_id
FROM vehicle_master vm
WHERE vma.vehicle_id = vm.id AND vma.company_id IS NULL;
ALTER TABLE vehicle_maintenance ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE vehicle_maintenance ALTER COLUMN company_id
  SET DEFAULT '00000000-0000-4000-8000-000000000001';

ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS company_id UUID
  REFERENCES companies(id);
UPDATE app_settings
SET company_id = '00000000-0000-4000-8000-000000000001'
WHERE company_id IS NULL;
ALTER TABLE app_settings ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE app_settings ALTER COLUMN company_id
  SET DEFAULT '00000000-0000-4000-8000-000000000001';

-- Usernames and plate numbers only need to be unique inside a company.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_username_key;
DROP INDEX IF EXISTS idx_users_username;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_company_username
  ON users(company_id, username);

ALTER TABLE vehicle_master
  DROP CONSTRAINT IF EXISTS vehicle_master_plate_number_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_vehicle_company_plate
  ON vehicle_master(company_id, plate_number);

ALTER TABLE app_settings DROP CONSTRAINT IF EXISTS app_settings_pkey;
ALTER TABLE app_settings
  ADD CONSTRAINT app_settings_pkey PRIMARY KEY (company_id, key);

CREATE INDEX IF NOT EXISTS idx_users_company ON users(company_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_company ON vehicle_master(company_id);
CREATE INDEX IF NOT EXISTS idx_checklist_company ON checklist_items(company_id);
CREATE INDEX IF NOT EXISTS idx_inspections_company ON inspection_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_issues_company ON issue_reports(company_id);

-- RLS remains defense-in-depth even though API handlers also scope every query.
DROP POLICY IF EXISTS "checklist_read_all" ON checklist_items;
CREATE POLICY "checklist_read_company" ON checklist_items
  FOR SELECT USING (
    company_id::text = current_setting('app.user_company_id', true)
  );

DROP POLICY IF EXISTS "vehicle_read" ON vehicle_master;
CREATE POLICY "vehicle_read" ON vehicle_master
  FOR SELECT USING (
    company_id::text = current_setting('app.user_company_id', true)
    AND (
      current_setting('app.user_role', true) = 'admin'
      OR fleet_id = current_setting('app.user_fleet_id', true)
    )
  );

DROP POLICY IF EXISTS "inspection_read" ON inspection_logs;
CREATE POLICY "inspection_read" ON inspection_logs
  FOR SELECT USING (
    company_id::text = current_setting('app.user_company_id', true)
    AND (
      current_setting('app.user_role', true) = 'admin'
      OR fleet_id = current_setting('app.user_fleet_id', true)
    )
  );

DROP POLICY IF EXISTS "inspection_insert" ON inspection_logs;
CREATE POLICY "inspection_insert" ON inspection_logs
  FOR INSERT WITH CHECK (
    company_id::text = current_setting('app.user_company_id', true)
    AND fleet_id = current_setting('app.user_fleet_id', true)
  );

DROP POLICY IF EXISTS "issues_read" ON issue_reports;
CREATE POLICY "issues_read" ON issue_reports
  FOR SELECT USING (
    company_id::text = current_setting('app.user_company_id', true)
    AND (
      current_setting('app.user_role', true) = 'admin'
      OR fleet_id = current_setting('app.user_fleet_id', true)
    )
  );

DROP POLICY IF EXISTS "issues_update" ON issue_reports;
CREATE POLICY "issues_update" ON issue_reports
  FOR UPDATE USING (
    company_id::text = current_setting('app.user_company_id', true)
    AND (
      current_setting('app.user_role', true) = 'admin'
      OR fleet_id = current_setting('app.user_fleet_id', true)
    )
  );

DROP POLICY IF EXISTS "issues_insert" ON issue_reports;
CREATE POLICY "issues_insert" ON issue_reports
  FOR INSERT WITH CHECK (
    company_id::text = current_setting('app.user_company_id', true)
    AND fleet_id = current_setting('app.user_fleet_id', true)
  );

COMMIT;
