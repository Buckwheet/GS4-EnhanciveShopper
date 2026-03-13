-- Create recommendation cache table
CREATE TABLE IF NOT EXISTS recommendation_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  discord_id TEXT NOT NULL,
  goal_set_name TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'cost',
  recommendations_json TEXT NOT NULL,
  calculated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(discord_id, goal_set_name, mode)
);

CREATE INDEX IF NOT EXISTS idx_rec_cache ON recommendation_cache(discord_id, goal_set_name);
