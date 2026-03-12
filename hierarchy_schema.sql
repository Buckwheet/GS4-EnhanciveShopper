-- Proper hierarchy schema
-- Phase 1: Create new tables

-- Characters table (top level)
CREATE TABLE IF NOT EXISTS characters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  discord_id TEXT NOT NULL,
  character_name TEXT NOT NULL,
  base_stats TEXT,
  skill_ranks TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(discord_id, character_name)
);

-- Sets table (belongs to character)
CREATE TABLE IF NOT EXISTS sets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  character_id INTEGER NOT NULL,
  set_name TEXT NOT NULL,
  account_type TEXT DEFAULT 'F2P',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
  UNIQUE(character_id, set_name)
);

-- Migrate data from character_sets to characters + sets
-- Step 1: Extract unique characters (discord_id + inferred character name)
-- For now, we'll use set_name as character_name since we don't have character names yet
INSERT INTO characters (discord_id, character_name, base_stats, skill_ranks, created_at)
SELECT 
  discord_id,
  set_name as character_name,
  base_stats,
  skill_ranks,
  created_at
FROM character_sets
WHERE true
ON CONFLICT(discord_id, character_name) DO NOTHING;

-- Step 2: Create sets linked to characters
INSERT INTO sets (character_id, set_name, account_type, created_at)
SELECT 
  c.id as character_id,
  'Default' as set_name,
  cs.account_type,
  cs.created_at
FROM character_sets cs
JOIN characters c ON c.discord_id = cs.discord_id AND c.character_name = cs.set_name;

-- Step 3: Update set_goals to reference new sets table
ALTER TABLE set_goals ADD COLUMN set_id INTEGER;

UPDATE set_goals
SET set_id = (
  SELECT s.id
  FROM sets s
  JOIN characters c ON s.character_id = c.id
  WHERE set_goals.character_set_id = (
    SELECT cs.id 
    FROM character_sets cs 
    WHERE cs.discord_id = c.discord_id 
    AND cs.set_name = c.character_name
  )
);

-- Step 4: Update set_inventory to reference new sets table
ALTER TABLE set_inventory ADD COLUMN set_id INTEGER;

UPDATE set_inventory
SET set_id = (
  SELECT s.id
  FROM sets s
  JOIN characters c ON s.character_id = c.id
  WHERE set_inventory.character_set_id = (
    SELECT cs.id 
    FROM character_sets cs 
    WHERE cs.discord_id = c.discord_id 
    AND cs.set_name = c.character_name
  )
);
