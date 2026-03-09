-- Migration: Add available flag and last_seen timestamp
-- Run this in D1 Console: https://dash.cloudflare.com/?to=/:account/workers/d1

ALTER TABLE shop_items ADD COLUMN last_seen TEXT;
ALTER TABLE shop_items ADD COLUMN available INTEGER NOT NULL DEFAULT 1;

-- Set last_seen to scraped_at for existing items
UPDATE shop_items SET last_seen = scraped_at WHERE last_seen IS NULL;

-- Create index for filtering available items
CREATE INDEX IF NOT EXISTS idx_shop_items_available ON shop_items(available);
