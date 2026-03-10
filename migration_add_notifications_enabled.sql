-- Add notifications_enabled column to users table
ALTER TABLE users ADD COLUMN notifications_enabled INTEGER DEFAULT 0;
