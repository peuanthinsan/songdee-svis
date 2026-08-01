-- Persistent login throttling for serverless API instances.
-- Only HMAC hashes are stored; usernames and IP addresses are never persisted.

CREATE TABLE IF NOT EXISTS auth_login_failures (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  company_slug TEXT NOT NULL,
  username_hash CHAR(64) NOT NULL,
  ip_hash CHAR(64) NOT NULL,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_login_failures_attempted
  ON auth_login_failures(attempted_at);

CREATE INDEX IF NOT EXISTS idx_auth_login_failures_username
  ON auth_login_failures(username_hash, attempted_at);

CREATE INDEX IF NOT EXISTS idx_auth_login_failures_ip
  ON auth_login_failures(ip_hash, attempted_at);

CREATE INDEX IF NOT EXISTS idx_auth_login_failures_username_ip
  ON auth_login_failures(username_hash, ip_hash, attempted_at);
