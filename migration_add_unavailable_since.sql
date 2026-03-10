-- Add unavailable_since column to track when items were sold
ALTER TABLE shop_items ADD COLUMN unavailable_since TEXT;

-- Update existing unavailable items with current timestamp
UPDATE shop_items SET unavailable_since = datetime('now') WHERE available = 0 AND unavailable_since IS NULL;
