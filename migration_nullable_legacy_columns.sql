-- Make character_set_id nullable in set_inventory and set_goals
-- This allows the new set_id column to be used instead

-- SQLite doesn't support ALTER COLUMN, so we need to recreate the tables

-- Backup and recreate set_inventory
CREATE TABLE set_inventory_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  character_set_id INTEGER,  -- Now nullable
  set_id INTEGER,
  item_name TEXT NOT NULL,
  slot TEXT NOT NULL,
  enhancives_json TEXT NOT NULL,
  is_permanent INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY (set_id) REFERENCES sets(id) ON DELETE CASCADE
);

INSERT INTO set_inventory_new SELECT * FROM set_inventory;
DROP TABLE set_inventory;
ALTER TABLE set_inventory_new RENAME TO set_inventory;

-- Backup and recreate set_goals
CREATE TABLE set_goals_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  character_set_id INTEGER,  -- Now nullable
  set_id INTEGER,
  stat TEXT NOT NULL,
  min_boost INTEGER NOT NULL,
  max_cost INTEGER,
  preferred_slots TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (set_id) REFERENCES sets(id) ON DELETE CASCADE
);

INSERT INTO set_goals_new SELECT * FROM set_goals;
DROP TABLE set_goals;
ALTER TABLE set_goals_new RENAME TO set_goals;
