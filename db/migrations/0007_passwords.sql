-- Add password_hash column to users.
-- Nullable so existing users are preserved; they simply cannot log in
-- until an admin sets their password via the user management panel.
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash text;
