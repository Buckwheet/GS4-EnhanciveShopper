# Session Progress — 2026-03-17

## Completed

### 1. Column Alignment Fix
- Header and body tables were misaligned after virtualization split them into two `<table>` elements
- Fixed with `table-fixed` layout and matching `<colgroup>` widths on both tables
- Widths: Name 22%, Town 8%, Shop 8%, Cost 10%, Slot 7%, Match Sum 5%, Total Sum 5%, Enhancives 35%
- Commit `7ceee60`

### 2. Algorithm Selection — Full Simulation Study
Ran Mejora's hunting set (character id=8, set id=4) through multiple shopping strategies to find the optimal recommendation algorithm.

**Test case:** 5 goals with gaps: MC=34, Weapons=25, Recovery=22, Lore-Religion=47, Lore-Blessings=50 (total=178 points needed across 14 available slots)

**Strategies tested:**
1. Hybrid (cheap wins then max score) — 72% fill, burned all slots on junk
2. Multi-goal priority — 98% fill, 182M, good but expensive
3. Largest gap first — 100% fill, 384M, overspent on single-purpose items
4. Balanced proportional fill — 100% fill, 803M, no cost awareness
5. **Balanced + log10 cost penalty — 100% fill, best cost, winner**

**Winner: `proportional_gap_fill / log10(cost)^alpha`**

### 3. Cost Penalty Tuning (log base vs alpha)
- Discovered changing log BASE (log8/log10/log12) produces identical results — it's a uniform scalar that doesn't change relative rankings
- The real knob is ALPHA (exponent on log10):
  - alpha=1.0: Cash flush (337M, willing to spend)
  - alpha=1.5: Balanced (290M, finds deals)
  - alpha=2.0: Cash adverse (258M, multi-goal wearables first)
- Recommended default: alpha=1.5, user-configurable as Budget/Balanced/Aggressive

### 4. Constraint Discovery and Fixes (iterative)
Each simulation run revealed missing constraints:

**a) Shields and ranged weapons are nuggets for casters**
- Shields go in hand slot, casters don't want that
- Crossbows/bows same — held items
- Added to NUGGET_SLOTS: shoulders (shields), chest (armor)

**b) Chest slot is locked (armor)**
- Algorithm was picking 3 chest items — only 1 slot exists and it's locked
- Chest items become nuggets (+25M)

**c) Slot limits must be enforced per pick**
- Added slot tracking: decrement available count after each pick
- Nugget items consume from general pool

**d) Pell cost for non-permanent wearables**
- 1/3 of shop items are non-permanent (1,829 of 5,691)
- Non-permanent wearables need a pell (+10M) to make permanent
- Nuggets auto-include permanence, so no pell needed for nuggets
- Added to true cost: `if wearable and not permanent: +10M`

**e) Replacement slot classification was wrong**
- Was treating ALL over-cap Wisdom items as free replacements (4 items = 17 slots)
- Wisdom surplus is only 5. Crown has +6 WIS > surplus — NOT free, it's conditional
- Only pink topaz bracer (+4 WIS, ≤ surplus 5) and empty earring are truly free
- Corrected to 14 slots (12 open + 2 free)
- Key rule: re-evaluate replaceability after each pick as surplus changes

**f) Bloodstone family exclusion**
- User already owns oval bloodstone barrette — only one active at a time
- Filter out all bloodstone variants from recommendations

**g) Yakushi shop exclusion**
- User preference to exclude this shop

### 5. Sylinara Swap Cost
- Swapping an enhancive to a different ability within its group costs 10,000 soul shards = 10M silver per swap
- Flat fee regardless of boost value
- An item with +10 SMC, +10 EMC, +10 MMC targeting Spirit MC: score=30, swap cost=20M (EMC and MMC each need swap, SMC is free)
- For multi-goal groups (Lores x2): engine should assign to goal that minimizes swap count
- True cost formula: `itemPrice + nuggetCost + pellCost + (numSwaps × 10M)`

### 6. Dual Lore Goals Discovery
- User clarified Religion and Blessings are TWO separate goals, each needing 50
- Lore points are NOT pooled — each item's lore is committed to ONE goal via swap
- Total lore gap: 97 (not 47), which nearly doubled the problem size
- Engine must ALLOCATE lore enhancives across goals, not just sum them

### 7. Algorithm Identified as Multi-Dimensional Knapsack Problem
- NP-hard in general, tractable for our instance (small goals, bounded slots)
- Greedy heuristic with constraint checking for single items
- Bounded combinatorial search for 2-3 item combos (future)

## Key Design Decisions

### Scoring Formula
```
score = sum(min(contribution[g], gap[g]) / gap[g] for each goal g)
penalty = log10(trueCost)^alpha
value = score / penalty
```

### True Cost Formula
```
trueCost = itemPrice
  + (25M if needs nugget)      // held/armor items for casters
  + (10M if needs pell)        // non-permanent wearables
  + (10M × numSwapsNeeded)     // enhancives not matching target ability
```

### Alpha Preference
| Setting | Alpha | Behavior |
|---------|-------|----------|
| Budget | 2.0 | Finds multi-goal wearables, avoids expensive items |
| Balanced | 1.5 | Default — good deals without obsessing |
| Aggressive | 1.0 | Best single item per gap, willing to spend |

### Stop Threshold
- 100% = fill all gaps (default)
- 95% = skip expensive tail-end items closing tiny gaps (secondary default)

## Files Created
- `shop_mejora.py` — Initial scoring engine, top items by raw score and efficiency
- `shop_greedy.py` — Max-score greedy shopping list builder
- `shop_budget.py` — Budget-efficient greedy builder
- `shop_strategies.py` — 5-strategy comparison (the key simulation)
- `shop_v3.py` — Shields/ranged as nuggets
- `shop_v4.py` — Slot-aware with limits
- `shop_v5.py` — Dual lore goals
- `shop_v6.py` — Pell costs added
- `shop_v7.py` — Corrected 14 slots (final version)
- `shop_logbase.py` — Log base comparison (proved bases are equivalent)
- `shop_alpha.py` — cost^alpha vs log^alpha comparison
- `analyze_mejora.py` — Inventory analysis and apron deep dive
- `ALGORITHM_SELECTION_REPORT.md` — Shareable report for team
- `ENGINE_DESIGN_NOTES.md` — Updated with all findings

## Not Yet Implemented
1. **Inventory swap recommendations** — Algorithm doesn't evaluate replacing existing items with better shop items. Only considers open slots.
2. **Sylinara swap cost in scoring** — Noted but not yet added to true_cost in simulations
3. **Dynamic replacement evaluation** — Should re-classify replaceable items each round as surpluses change
4. **Swatch cost** — 25M to convert item to different slot type (not modeled yet)
5. **Unique item family detection** — Only bloodstone manually excluded; need general system

## Commits This Session
- `7ceee60` — Fix column misalignment between header and body tables
- `7ac151f` — Add session progress 2026-03-16 part 2
- `6ae31dc` — Engine design notes: swap/replacement strategy, shopping simulations
- `7a1c046` — Engine notes: unique item constraints, hybrid shopping strategy
- `a7fe765` — Algorithm selection report — 5 strategies compared
- `3ceabf1` — Engine notes: log10^alpha cost penalty formula
- `85f139c` — Engine notes: fix replacement classification bug
- `bae0b8b` — Engine notes: sylinara cost, inventory swap recommendation gap
- `b46207d` — Engine notes: correct sylinara cost to 10M per swap
- `1a7be47` — Engine notes: swap cost calculation per enhancive
