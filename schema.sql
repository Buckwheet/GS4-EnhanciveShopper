-- Users table
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- User goals table
CREATE TABLE IF NOT EXISTS user_goals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  stat_name TEXT NOT NULL,
  current_value INTEGER NOT NULL DEFAULT 0,
  target_value INTEGER NOT NULL,
  max_price INTEGER,
  available_slot TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Shop items table
CREATE TABLE IF NOT EXISTS shop_items (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  town TEXT NOT NULL,
  shop TEXT NOT NULL,
  cost INTEGER,
  enchant INTEGER,
  worn TEXT,
  enhancives_json TEXT NOT NULL,
  scraped_at TEXT NOT NULL,
  last_seen TEXT NOT NULL,
  available INTEGER NOT NULL DEFAULT 1,
  unavailable_since TEXT  -- When item was marked unavailable
);

-- Alerts table
CREATE TABLE IF NOT EXISTS alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  item_id TEXT NOT NULL,
  matched_criteria TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  read_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (item_id) REFERENCES shop_items(id) ON DELETE CASCADE
);

-- Metadata table for tracking scraper state
CREATE TABLE IF NOT EXISTS metadata (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_shop_items_town ON shop_items(town);
CREATE INDEX IF NOT EXISTS idx_shop_items_worn ON shop_items(worn);
CREATE INDEX IF NOT EXISTS idx_user_goals_user_id ON user_goals(user_id);
CREATE INDEX IF NOT EXISTS idx_alerts_user_id ON alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_alerts_read_at ON alerts(read_at);
