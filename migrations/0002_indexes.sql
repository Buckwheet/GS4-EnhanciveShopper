-- Reduce D1 rows-read: index the column(s) used in WHERE filters.
-- sales_log grows large (109K+ rows); sold_at is scanned in full per scrape.
CREATE INDEX IF NOT EXISTS idx_sales_log_sold_at ON sales_log(sold_at);

-- shop_items scans: WHERE available = 1 (per request) and the 72h cleanup
-- WHERE available = 0 AND unavailable_since < ?.
CREATE INDEX IF NOT EXISTS idx_shop_items_available_unavailable
  ON shop_items(available, unavailable_since);

-- matcher / de-N+1 lookups filter by set_id / character_id every scrape.
CREATE INDEX IF NOT EXISTS idx_set_goals_set_id ON set_goals(set_id);
CREATE INDEX IF NOT EXISTS idx_sets_character_id ON sets(character_id);
