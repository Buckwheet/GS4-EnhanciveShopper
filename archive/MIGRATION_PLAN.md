# Schema Migration Plan

## Current Problems
1. `user_goals` table mixes set metadata (account_type, base_stats, skill_ranks) with individual goals
2. Each goal row duplicates set-level data
3. Can't have a set without at least one goal (need placeholder)
4. "Goal set" naming is confusing - it's really a character/equipment set

## New Schema
- `character_sets`: discord_id, set_name, account_type, base_stats, skill_ranks
- `set_inventory`: character_set_id, item_name, slot, enhancives_json, is_permanent
- `set_goals`: character_set_id, stat, min_boost, max_cost, preferred_slots

## Migration Steps

### Step 1: Run schema.sql on D1 database
```bash
wrangler d1 execute enhancive-db --file=schema.sql --remote
```

This will:
- Create new tables
- Migrate existing data
- Keep old tables intact (for rollback)

### Step 2: Update API endpoints (one at a time)
- GET /api/character-sets (replaces /api/goals for listing sets)
- POST /api/character-sets (create new set)
- PUT /api/character-sets/:id (update set metadata)
- DELETE /api/character-sets/:id (delete set and cascade)
- GET /api/character-sets/:id/goals (get goals for a set)
- POST /api/character-sets/:id/goals (add goal)
- PUT /api/goals/:id (update individual goal)
- DELETE /api/goals/:id (delete individual goal)
- GET /api/character-sets/:id/inventory (get inventory)
- POST /api/character-sets/:id/inventory (add item)
- PUT /api/inventory/:id (update item)
- DELETE /api/inventory/:id (delete item)

### Step 3: Update frontend to use new endpoints
- Update loadGoals() to use new structure
- Update set selector to use character_sets
- Update inventory management
- Update goal management

### Step 4: Test thoroughly

### Step 5: Drop old tables
```sql
DROP TABLE user_goals;
DROP TABLE user_inventory;
```

## Rollback Plan
If issues arise, old tables still exist. Can revert code changes and continue using old schema.
