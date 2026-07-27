CREATE INDEX IF NOT EXISTS idx_inspection_results_inspection_id ON inspection_results(inspection_id);
CREATE INDEX IF NOT EXISTS idx_inspection_logs_vehicle_id ON inspection_logs(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_issue_reports_vehicle_id ON issue_reports(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_issue_reports_created ON issue_reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_issue_reports_status_created ON issue_reports(status, created_at DESC);
