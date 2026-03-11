-- New schema: Separate character sets from goals

-- Character sets (what we currently call "goal sets")
CREATE TABLE IF NOT EXISTS character_sets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  discord_id TEXT NOT NULL,
  set_name TEXT NOT NULL,
  account_type TEXT DEFAULT 'F2P',
  base_stats TEXT,
  skill_ranks TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(discord_id, set_name)
);

-- Inventory items for each character set
CREATE TABLE IF NOT EXISTS set_inventory (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  character_set_id INTEGER NOT NULL,
  item_name TEXT NOT NULL,
  slot TEXT NOT NULL,
  enhancives_json TEXT NOT NULL,
  is_permanent INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY (character_set_id) REFERENCES character_sets(id) ON DELETE CASCADE
);

-- Alert goals for each character set
CREATE TABLE IF NOT EXISTS set_goals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  character_set_id INTEGER NOT NULL,
  stat TEXT NOT NULL,
  min_boost INTEGER NOT NULL,
  max_cost INTEGER,
  preferred_slots TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (character_set_id) REFERENCES character_sets(id) ON DELETE CASCADE
);

-- Migration: Create character_sets from existing user_goals
INSERT INTO character_sets (discord_id, set_name, account_type, base_stats, skill_ranks, created_at)
SELECT 
  discord_id,
  COALESCE(goal_set_name, 'Default') as set_name,
  COALESCE(account_type, 'F2P') as account_type,
  base_stats,
  skill_ranks,
  MIN(created_at) as created_at
FROM user_goals
GROUP BY discord_id, COALESCE(goal_set_name, 'Default');

-- Migration: Move inventory to set_inventory
INSERT INTO set_inventory (character_set_id, item_name, slot, enhancives_json, is_permanent, created_at)
SELECT 
  cs.id,
  ui.item_name,
  ui.slot,
  ui.enhancives_json,
  ui.is_permanent,
  ui.created_at
FROM user_inventory ui
JOIN character_sets cs ON cs.discord_id = ui.discord_id AND cs.set_name = ui.goal_set_name;

-- Migration: Move goals to set_goals (exclude placeholders)
INSERT INTO set_goals (character_set_id, stat, min_boost, max_cost, preferred_slots, created_at)
SELECT 
  cs.id,
  ug.stat,
  ug.min_boost,
  ug.max_cost,
  ug.preferred_slots,
  ug.created_at
FROM user_goals ug
JOIN character_sets cs ON cs.discord_id = ug.discord_id AND cs.set_name = COALESCE(ug.goal_set_name, 'Default')
WHERE ug.stat != '_placeholder';
