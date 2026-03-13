-- Add is_irreplaceable column to user_inventory
ALTER TABLE user_inventory ADD COLUMN is_irreplaceable INTEGER NOT NULL DEFAULT 0;
