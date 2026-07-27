CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE vehicle_master (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plate_number TEXT UNIQUE NOT NULL,
  vehicle_type TEXT NOT NULL CHECK (vehicle_type IN ('car', 'e_van', 'motorcycle')),
  fleet_id TEXT NOT NULL,
  fleet_manager_email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_type TEXT NOT NULL CHECK (vehicle_type IN ('car', 'motorcycle')),
  frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly')),
  item_name_th TEXT NOT NULL,
  item_name_en TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE inspection_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES vehicle_master(id),
  inspector_id TEXT NOT NULL,
  inspector_name TEXT NOT NULL,
  fleet_id TEXT NOT NULL,
  inspection_date DATE NOT NULL,
  overall_status TEXT NOT NULL CHECK (overall_status IN ('pass', 'fail')),
  photo_urls TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(vehicle_id, inspection_date)
);

CREATE TABLE inspection_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id UUID NOT NULL REFERENCES inspection_logs(id) ON DELETE CASCADE,
  checklist_item_id UUID NOT NULL REFERENCES checklist_items(id),
  result TEXT NOT NULL CHECK (result IN ('pass', 'fail'))
);

CREATE TABLE issue_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id UUID NOT NULL REFERENCES inspection_logs(id),
  vehicle_id UUID NOT NULL REFERENCES vehicle_master(id),
  fleet_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'completed')),
  defect_photo_urls TEXT[] NOT NULL DEFAULT '{}',
  completion_photo_urls TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_inspection_logs_date ON inspection_logs(inspection_date);
CREATE INDEX idx_inspection_logs_fleet ON inspection_logs(fleet_id);
CREATE INDEX idx_inspection_logs_vehicle_date ON inspection_logs(vehicle_id, inspection_date);
CREATE INDEX idx_issue_reports_fleet ON issue_reports(fleet_id);
CREATE INDEX idx_issue_reports_status ON issue_reports(status);
CREATE INDEX idx_vehicle_master_fleet ON vehicle_master(fleet_id);
