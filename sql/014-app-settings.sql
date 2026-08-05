-- App-wide key/value settings (e.g. Google Sheets URL for unit status).
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default keys so the admin UI always has something to display.
-- ON CONFLICT (key) is correct here: at this point in the migration order,
-- `key` is still the sole PRIMARY KEY. Migration 019 later replaces it with
-- the composite PRIMARY KEY (company_id, key). Do not change this target and
-- do not replay this file against a post-019 database (raises error 42P10).
INSERT INTO app_settings (key, value) VALUES ('unit_status_sheet_url', '')
  ON CONFLICT (key) DO NOTHING;
