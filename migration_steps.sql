-- Step 1: Create new tables (run this first)
CREATE TABLE IF NOT EXISTS characters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  discord_id TEXT NOT NULL,
  character_name TEXT NOT NULL,
  account_type TEXT DEFAULT 'F2P',
  base_stats TEXT,
  skill_ranks TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(discord_id, character_name)
);

-- Step 2: Create equipment_sets (run this second)
CREATE TABLE IF NOT EXISTS equipment_sets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  character_id INTEGER NOT NULL,
  set_name TEXT NOT NULL,
  item_name TEXT NOT NULL,
  slot TEXT NOT NULL,
  enhancives_json TEXT NOT NULL,
  is_permanent INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
  UNIQUE(character_id, set_name, item_name)
);

-- Step 3: Create alert_goals (run this third)
CREATE TABLE IF NOT EXISTS alert_goals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  character_id INTEGER NOT NULL,
  stat TEXT NOT NULL,
  min_boost INTEGER NOT NULL,
  max_cost INTEGER,
  preferred_slots TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
);

-- Step 4: Migrate characters from user_inventory (run this fourth)
INSERT INTO characters (discord_id, character_name, account_type, created_at)
SELECT DISTINCT discord_id, goal_set_name, 'F2P', datetime('now')
FROM user_inventory;

-- Step 5: Migrate equipment (run this fifth)
INSERT INTO equipment_sets (character_id, set_name, item_name, slot, enhancives_json, is_permanent, created_at)
SELECT c.id, 'Default', i.item_name, i.slot, i.enhancives_json, i.is_permanent, i.created_at
FROM user_inventory i
JOIN characters c ON c.discord_id = i.discord_id AND c.character_name = i.goal_set_name;

-- Step 6: Migrate goals if any exist (run this sixth)
INSERT INTO alert_goals (character_id, stat, min_boost, max_cost, preferred_slots, created_at)
SELECT c.id, g.stat, g.min_boost, g.max_cost, g.preferred_slots, g.created_at
FROM user_goals g
JOIN characters c ON c.discord_id = g.discord_id AND c.character_name = COALESCE(g.goal_set_name, 'Default')
WHERE g.stat != '_placeholder';

-- Step 7: Update characters with stats/skills (run this seventh)
UPDATE characters
SET base_stats = (
  SELECT base_stats FROM user_goals 
  WHERE user_goals.discord_id = characters.discord_id 
  AND COALESCE(user_goals.goal_set_name, 'Default') = characters.character_name
  AND base_stats IS NOT NULL
  LIMIT 1
),
skill_ranks = (
  SELECT skill_ranks FROM user_goals 
  WHERE user_goals.discord_id = characters.discord_id 
  AND COALESCE(user_goals.goal_set_name, 'Default') = characters.character_name
  AND skill_ranks IS NOT NULL
  LIMIT 1
),
account_type = COALESCE((
  SELECT account_type FROM user_goals 
  WHERE user_goals.discord_id = characters.discord_id 
  AND COALESCE(user_goals.goal_set_name, 'Default') = characters.character_name
  AND account_type IS NOT NULL
  LIMIT 1
), 'F2P');
