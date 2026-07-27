-- Migration 016: Vendor contact + notification tracking
ALTER TABLE vehicle_master ADD COLUMN IF NOT EXISTS vendor_email TEXT;
ALTER TABLE issue_reports ADD COLUMN IF NOT EXISTS vendor_notified_at TIMESTAMPTZ;
