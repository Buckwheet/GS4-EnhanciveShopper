-- Fix NULL values before migration
UPDATE set_goals SET min_boost = 0 WHERE min_boost IS NULL;
UPDATE set_goals SET stat = '_placeholder' WHERE stat IS NULL OR stat = '';
