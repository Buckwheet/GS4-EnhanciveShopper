# Swap Group-Aware Matching Engine

## Core Insight

GemStone IV merchant services allow enhancives within the same group to be swapped to any other in that group. This means all enhancives in a swap group are **fungible** — their individual types don't matter, only the **total ranks across the group on an item**.

A single item with +5 Fire Lore, +2 Air Lore, +7 Blessings Lore, +1 Summoning Lore = **+15 lore ranks** toward any single lore goal after swapping.

## Swap Groups (from gswiki.play.net/Enhancive_services)

```
Stat Group A:    Strength, Wisdom, Aura
Stat Group B:    Constitution, Dexterity, Agility, Discipline
Stat Group C:    Logic, Intuition, Influence
Weapons:         Edged, Blunt, Ranged, Thrown, Polearm, Two-Handed, Brawling + Spell Aiming
                 (EXCLUDES: TWC, MOC, Combat Maneuvers)
MIU/AS:          Magic Item Use, Arcane Symbols
Mana Controls:   Elemental MC, Spirit MC, Mental MC
Lores:           ALL lores (Elemental, Spiritual, Sorcerous, Mental — all subtypes)
Recovery:        Mana Recovery, Stamina Recovery, Health Recovery (health at 1/2 value)
```

Each group applies to both Base and Bonus variants (for stats) and both Bonus and Ranks variants (for skills).

### Items NOT in any swap group (standalone)
- Max Health, Max Mana, Max Stamina, Max Spirit
- Spirit Recovery
- Dodging, Physical Fitness, Climbing, Swimming, First Aid
- Stalking and Hiding, Perception, Picking Locks, Disarming Traps, Pickpocketing
- Harness Power, Armor Use, Shield Use, Survival, Trading
- Combat Maneuvers, Multi Opponent Combat, Two Weapon Combat
- Ambush
- Dark Catalyst, Energy Maelstrom, Mana Disruption (special properties)

## New Goal Model

### Current (manual approximation)
```
User creates: "lore" min_boost: 15
System checks: does any single enhancive contain "lore" with boost >= 15?
Problem: misses items with multiple smaller lores that sum to 15+
Problem: user must understand swap groups and set thresholds manually
```

### New (swap-group-aware)
```
User creates: "Spiritual Lore - Blessings" target: 50 (the cap)
System knows:
  1. Blessings is in the "Lores" swap group
  2. User's current inventory has X total lore ranks across all equipped items
  3. Gap = 50 - X
System scans items:
  1. Sum ALL lore enhancives on each item (any lore type, any Base/Bonus/Ranks)
  2. That sum = item's contribution toward the lore goal
  3. Rank items by gap-fill significance, cost efficiency, slot availability
  4. Alert when an item fills a meaningful portion of the gap
```

### Goal Fields (new schema)
```sql
-- Replace min_boost with target_total
ALTER TABLE set_goals ADD COLUMN target_total INTEGER;  -- e.g., 50 for skill cap
-- min_boost becomes optional legacy / simple mode
-- stat becomes the specific ability name (e.g., "Spiritual Lore - Blessings")
-- System resolves which swap group it belongs to automatically
```

## Matching Algorithm

### Per-item scoring against a goal:
```
1. Identify the goal's swap group (e.g., "Spiritual Lore - Blessings" → Lores group)
2. Parse item's enhancives_json
3. Sum all enhancive boosts on the item that belong to the same swap group
   - For Recovery group: Health Recovery contributes at 1/2 value
4. That sum = item's "group contribution"
5. Compare against gap (target_total - current_inventory_total)
```

### Per-item scoring for standalone goals (no swap group):
```
1. Goal is for a standalone ability (e.g., "Dodging")
2. Sum only exact matches (Dodging Bonus + Dodging Ranks on the item)
3. That sum = item's contribution
```

### Alert threshold logic:
```
Instead of user-defined min_boost, use gap-relative significance:
- gap_fill_pct = item_contribution / remaining_gap
- Alert if gap_fill_pct >= threshold (e.g., 20% of remaining gap)
- Threshold could be user-configurable or smart default
- Example: need 30 more lore ranks, item has 15 lore = 50% fill → alert
- Example: need 30 more lore ranks, item has 3 lore = 10% fill → no alert
```

## Current Inventory Calculation

To know the gap, the system must calculate current totals from inventory:

```
For each goal:
  1. Get all items in the character's set inventory
  2. For each item, parse enhancives_json
  3. Sum all enhancives that belong to the goal's swap group
  4. Total = sum across all inventory items
  5. Gap = target_total - total
```

## Display Changes

### Match Sum column (existing)
Currently correct by accident — substring matching + individual summing produces the right number when enhancives in the same group appear on one item. No change needed for display.

### Goal creation UI
- Change from free-text stat + min_boost to:
  - Dropdown of specific abilities (populated from known ability list)
  - Target total field (default to cap: 40 for stats, 50 for skills)
  - System auto-resolves swap group
- Keep simple mode available for users who want basic "find me +X of this"

### Summary / Gap display
- Show: "Spiritual Lore - Blessings: 20/50 (need 30 more)"
- Current total calculated from inventory using swap group summing
- Gap shown clearly

## Implementation Phases

### Phase 1: Swap Group Definitions
- Add swap group constants to `src/constants.ts`
- Function: `getSwapGroup(abilityName) → group name or null`
- Function: `getGroupMembers(groupName) → ability names[]`
- Function: `isInSameSwapGroup(ability1, ability2) → boolean`

### Phase 2: Group-Aware Item Scoring
- Function: `calculateGroupContribution(item, goalAbility) → number`
  - Sums all enhancives on item that share the goal's swap group
  - Handles standalone abilities (exact match only)
  - Handles Recovery health 1/2 value rule
- Update frontend `calculateMatchSum` to use this

### Phase 3: Inventory Gap Calculation
- Function: `calculateCurrentTotal(inventory, goalAbility) → number`
  - Sums across all inventory items using swap group logic
- Function: `calculateGap(target, currentTotal) → number`
- Display gap in UI summary

### Phase 4: Target-Based Goals
- New goal creation UI with ability dropdown + target total
- Migrate existing goals where possible
- Alert threshold based on gap fill percentage instead of min_boost

### Phase 5: Smart Alerts
- Replace min_boost check in `matcher.ts` with gap-aware scoring
- Alert when item fills significant portion of remaining gap
- Configurable threshold per goal or global default

## Edge Cases

- **Base vs Bonus**: Both are in the same swap group. A +5 Strength Base and +3 Strength Bonus on the same item = 8 toward the Stat A group. But Base and Bonus serve different mechanical purposes (base stat vs bonus). The swap service preserves the type (Base stays Base, Bonus stays Bonus, Ranks stay Ranks). Summing them together for group contribution is still correct for "total ranks toward cap" purposes.
- **Health Recovery at 1/2**: When converting Health Recovery to Mana/Stamina Recovery (or vice versa), health is halved. +10 Health Recovery = +5 toward Mana Recovery goal.
- **Items with mixed groups**: An item with +10 EMC and +6 Demonology Lore contributes 10 toward a mana control goal AND 6 toward a lore goal independently.
- **Swap service availability**: Swaps require merchant events (Duskruin, Ebon Gate). The engine assumes swaps are available — users understand this is a future/event-dependent action.
