-- Add columns to user_goals for character data
ALTER TABLE user_goals ADD COLUMN account_type TEXT DEFAULT 'F2P';
ALTER TABLE user_goals ADD COLUMN base_stats TEXT;
ALTER TABLE user_goals ADD COLUMN skill_ranks TEXT;

-- Create inventory table for user's equipped items
CREATE TABLE IF NOT EXISTS user_inventory (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  discord_id TEXT NOT NULL,
  goal_set_name TEXT NOT NULL,
  item_name TEXT NOT NULL,
  slot TEXT NOT NULL,
  enhancives_json TEXT NOT NULL,
  is_permanent INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_user_inventory ON user_inventory(discord_id, goal_set_name);

-- Create tracked stats table for cap monitoring
CREATE TABLE IF NOT EXISTS tracked_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  discord_id TEXT NOT NULL,
  goal_set_name TEXT NOT NULL,
  stat_or_skill TEXT NOT NULL,
  is_tracked INTEGER NOT NULL DEFAULT 1,
  UNIQUE(discord_id, goal_set_name, stat_or_skill)
);

CREATE INDEX IF NOT EXISTS idx_tracked_stats ON tracked_stats(discord_id, goal_set_name);
