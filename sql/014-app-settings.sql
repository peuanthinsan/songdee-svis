-- App-wide key/value settings (e.g. Google Sheets URL for unit status).
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default keys so the admin UI always has something to display.
INSERT INTO app_settings (key, value) VALUES ('unit_status_sheet_url', '')
  ON CONFLICT (key) DO NOTHING;
