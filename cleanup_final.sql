-- Final cleanup: Drop old tables and remove legacy columns

PRAGMA foreign_keys = OFF;

-- Step 1: Drop old tables
DROP TABLE IF EXISTS character_sets;
DROP TABLE IF EXISTS user_goals;
DROP TABLE IF EXISTS user_inventory;

-- Step 2: Remove character_set_id from set_goals
CREATE TABLE set_goals_clean (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  set_id INTEGER NOT NULL,
  stat TEXT NOT NULL,
  min_boost INTEGER NOT NULL,
  max_cost INTEGER,
  preferred_slots TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (set_id) REFERENCES sets(id) ON DELETE CASCADE
);

INSERT INTO set_goals_clean (id, set_id, stat, min_boost, max_cost, preferred_slots, created_at)
SELECT id, set_id, stat, min_boost, max_cost, preferred_slots, created_at FROM set_goals WHERE set_id IS NOT NULL;

DROP TABLE set_goals;
ALTER TABLE set_goals_clean RENAME TO set_goals;

-- Step 3: Remove character_set_id from set_inventory
CREATE TABLE set_inventory_clean (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  set_id INTEGER NOT NULL,
  item_name TEXT NOT NULL,
  slot TEXT NOT NULL,
  enhancives_json TEXT NOT NULL,
  is_permanent INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY (set_id) REFERENCES sets(id) ON DELETE CASCADE
);

INSERT INTO set_inventory_clean (id, set_id, item_name, slot, enhancives_json, is_permanent, created_at)
SELECT id, set_id, item_name, slot, enhancives_json, is_permanent, created_at FROM set_inventory WHERE set_id IS NOT NULL;

DROP TABLE set_inventory;
ALTER TABLE set_inventory_clean RENAME TO set_inventory;

PRAGMA foreign_keys = ON;
