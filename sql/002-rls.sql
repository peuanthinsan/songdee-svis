ALTER TABLE vehicle_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE issue_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "checklist_read_all" ON checklist_items
  FOR SELECT USING (true);

CREATE POLICY "vehicle_read" ON vehicle_master
  FOR SELECT USING (
    current_setting('app.user_role', true) = 'admin'
    OR fleet_id = current_setting('app.user_fleet_id', true)
  );

CREATE POLICY "inspection_read" ON inspection_logs
  FOR SELECT USING (
    current_setting('app.user_role', true) = 'admin'
    OR fleet_id = current_setting('app.user_fleet_id', true)
  );

CREATE POLICY "inspection_insert" ON inspection_logs
  FOR INSERT WITH CHECK (
    fleet_id = current_setting('app.user_fleet_id', true)
  );

CREATE POLICY "results_read" ON inspection_results
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM inspection_logs
      WHERE inspection_logs.id = inspection_results.inspection_id
    )
  );

CREATE POLICY "results_insert" ON inspection_results
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM inspection_logs
      WHERE inspection_logs.id = inspection_results.inspection_id
    )
  );

CREATE POLICY "issues_read" ON issue_reports
  FOR SELECT USING (
    current_setting('app.user_role', true) = 'admin'
    OR fleet_id = current_setting('app.user_fleet_id', true)
  );

CREATE POLICY "issues_update" ON issue_reports
  FOR UPDATE USING (
    current_setting('app.user_role', true) = 'admin'
    OR fleet_id = current_setting('app.user_fleet_id', true)
  );

CREATE POLICY "issues_insert" ON issue_reports
  FOR INSERT WITH CHECK (
    fleet_id = current_setting('app.user_fleet_id', true)
  );
