# Proper Hierarchy Migration Plan

## Goal
Implement proper 3-tier hierarchy: User → Characters → Sets → Goals/Inventory

## Current State (After First Migration)
```
user → character_sets (has: set_name, account_type, base_stats, skill_ranks)
         ↓
       set_goals
       set_inventory
```

**Problem**: "character_sets" is confusing. Stats/skills belong to CHARACTER, not set.

## Target State
```
user → characters (has: character_name, base_stats, skill_ranks)
         ↓
       sets (has: set_name, account_type)
         ↓
       set_goals
       set_inventory
```

## New Schema

### characters table
```sql
CREATE TABLE IF NOT EXISTS characters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  discord_id TEXT NOT NULL,
  character_name TEXT NOT NULL,
  base_stats TEXT,  -- JSON
  skill_ranks TEXT, -- JSON
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(discord_id, character_name)
);
```

### sets table (renamed from character_sets)
```sql
CREATE TABLE IF NOT EXISTS sets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  character_id INTEGER NOT NULL,
  set_name TEXT NOT NULL,
  account_type TEXT DEFAULT 'F2P',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
  UNIQUE(character_id, set_name)
);
```

### set_goals (update foreign key)
```sql
-- Already exists, just needs to reference sets.id
-- character_set_id → set_id (rename for clarity)
```

### set_inventory (update foreign key)
```sql
-- Already exists, just needs to reference sets.id
-- character_set_id → set_id (rename for clarity)
```

## Migration Steps (Small Chunks)

### Phase 1: Create New Schema (Chunks 1-5)
1. Create `characters` table
2. Create `sets` table (new structure)
3. Migrate data: Extract unique characters from `character_sets`
4. Migrate data: Create sets linked to characters
5. Verify data migration

### Phase 2: Update set_goals and set_inventory (Chunks 6-10)
6. Add `set_id` column to `set_goals` (nullable initially)
7. Populate `set_id` in `set_goals` from mapping
8. Add `set_id` column to `set_inventory` (nullable initially)
9. Populate `set_id` in `set_inventory` from mapping
10. Verify foreign key relationships

### Phase 3: API Endpoints - Characters (Chunks 11-15)
11. GET /api/characters (list user's characters)
12. POST /api/characters (create character)
13. PUT /api/characters/:id (update character stats/skills)
14. DELETE /api/characters/:id (delete character and cascade)
15. Test character endpoints

### Phase 4: API Endpoints - Sets (Chunks 16-20)
16. GET /api/characters/:id/sets (list sets for character)
17. POST /api/characters/:id/sets (create set for character)
18. PUT /api/sets/:id (update set name/account_type)
19. DELETE /api/sets/:id (delete set)
20. Test set endpoints

### Phase 5: Frontend - Character Management (Chunks 21-30)
21. Add character selector dropdown (top level)
22. Update set selector to filter by selected character
23. Create "Manage Characters" button/modal
24. Add character creation form
25. Add character edit form (stats/skills)
26. Add character delete button
27. Wire up character selector to load sets
28. Update localStorage to track currentCharacterId
29. Handle empty states (no characters, no sets)
30. Test character UI flow

### Phase 6: Frontend - Set Management (Chunks 31-35)
31. Update "Create Set" to require character selection
32. Update set dropdown to show character context
33. Update "Manage Character" button → "Manage Stats/Skills"
34. Move stats/skills editing to character level
35. Test set UI flow

### Phase 7: Update Remaining Systems (Chunks 36-45)
36. Update loadGoals to use character + set
37. Update loadInventory to use character + set
38. Update loadSummary to use character + set
39. Update matcher to use new hierarchy
40. Update AI chat context to use new hierarchy
41. Update all goal operations
42. Update all inventory operations
43. Test all CRUD operations
44. Test matcher with new schema
45. Test AI chat with new schema

### Phase 8: Cleanup (Chunks 46-50)
46. Drop `character_sets` table (old)
47. Remove `character_set_id` columns from set_goals/set_inventory
48. Remove legacy API endpoints
49. Update all documentation
50. Final end-to-end testing

## Rollback Plan
- Keep `character_sets`, `set_goals`, `set_inventory` tables until Phase 8
- Can revert code changes and continue using current schema
- New tables (`characters`, `sets`) can be dropped if needed

## Key Differences from Current
1. **Characters are first-class entities** - Created before sets
2. **Stats/skills belong to character** - Not duplicated per set
3. **Sets belong to characters** - Clear parent-child relationship
4. **UI flow**: Select character → Select set → Manage goals/inventory
5. **Clearer naming**: "sets" not "character_sets"

## Expected User Flow
1. Login with Discord
2. Create character ("Mejora")
3. Add character's base stats and skill ranks
4. Create set for character ("Default", "Premium Build")
5. Add goals to set
6. Add inventory to set
7. Switch between characters and their sets
