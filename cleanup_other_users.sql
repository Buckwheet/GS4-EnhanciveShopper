-- Delete all data except for discord_id 411322973920821258

-- Delete characters (cascades to sets, which cascades to goals/inventory)
DELETE FROM characters WHERE discord_id != '411322973920821258';

-- Delete old character_sets
DELETE FROM character_sets WHERE discord_id != '411322973920821258';

-- Delete old user_goals
DELETE FROM user_goals WHERE discord_id != '411322973920821258';

-- Delete old user_inventory  
DELETE FROM user_inventory WHERE discord_id != '411322973920821258';

-- Clean up any orphaned data
DELETE FROM set_goals WHERE set_id IS NOT NULL AND set_id NOT IN (SELECT id FROM sets);
DELETE FROM set_inventory WHERE set_id IS NOT NULL AND set_id NOT IN (SELECT id FROM sets);
