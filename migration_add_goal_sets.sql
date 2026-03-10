-- Add goal_set_name to user_goals table
ALTER TABLE user_goals ADD COLUMN goal_set_name TEXT DEFAULT 'Default';

-- Create index for filtering by set
CREATE INDEX IF NOT EXISTS idx_user_goals_set ON user_goals(discord_id, goal_set_name);
