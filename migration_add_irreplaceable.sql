-- Add is_irreplaceable column to set_inventory
ALTER TABLE set_inventory ADD COLUMN is_irreplaceable INTEGER NOT NULL DEFAULT 0;
