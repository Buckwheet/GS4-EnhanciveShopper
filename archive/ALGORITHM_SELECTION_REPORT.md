# Enhancive Shopping Engine — Algorithm Selection Report (v2)

## Problem Statement

GemStone IV's enhancive system allows players to wear items that boost their character's stats and skills. The **Enhancive Shopper** tool tracks ~5,700 items across all player shops and helps users find items that match their goals.

The core challenge: given a character's current inventory, a set of goals with target values, and a database of available shop items — **recommend the best set of purchases to fill the gaps between current totals and targets.**

This is complicated by several constraints:

1. **Swap groups** — GemStone's enhancive swap service (Sylinara) treats certain abilities as fungible within groups. An item with +8 Blunt Weapons counts toward a Spell Aiming goal because they're in the same Weapons group. There are 8 swap groups covering stats, skills, lores, mana controls, and recovery.

2. **Swap costs** — Each ability swap costs 10,000 soul shards (= 10M silver). An item with 3 enhancives all needing swaps adds 30M to its true cost. Items already matching the target ability cost nothing to swap.

3. **Slot limits** — Characters have a finite number of equipment slots (head, neck, wrist, pin, etc.). Some slots are occupied by locked items (armor, functional gear) that cannot be replaced.

4. **Replacement cascade** — Replacing an existing item affects ALL goals, not just the target goal. A crown with +6 Wisdom replaced by a helm with +10 Mana Control gains MC but may break the Wisdom target.

5. **Nugget costs** — Weapons, runestaffs, shields, and certain armor slots require a 25M silver "nugget" service to convert them into wearable enhancive items. This includes permanence.

6. **Pell costs** — Non-permanent wearable items need a 10M silver "pell" to make them permanent. Without this, the enhancive drains charges and eventually stops working.

7. **Multi-goal swap groups** — A single swap group can have multiple independent goals. Lores has 13 interchangeable skills, but a player may need both Religion 50 AND Blessings 50. Each item's lore contribution must be allocated to ONE goal — it can't count toward both simultaneously.

8. **Budget vs. completeness tradeoff** — Cheap items exist but carry small boosts. Expensive items carry large boosts. A pure budget approach burns all slots on junk. A pure "best score" approach overspends dramatically.

This is a variant of the **Multi-Dimensional Knapsack Problem** — NP-hard in general, but tractable for our instance due to small goal counts and bounded slot limits.

## Test Case: Mejora (Hunting Set)

### Current Goal Status
| Goal | Swap Group | Current | Target | Gap |
|------|-----------|---------|--------|-----|
| Wisdom | Stat A (STR/WIS/AUR) | 45 | 40 | 0 (over by 5) |
| Discipline | Stat B (CON/DEX/AGI/DIS) | 40 | 40 | 0 (capped) |
| Logic | Stat C (LOG/INT/INF) | 40 | 40 | 0 (capped) |
| Spirit MC | MC (Ele/Spi/Men MC) | 16 | 50 | **34** |
| Spell Aiming | Weapons (8 weapon skills) | 25 | 50 | **25** |
| Recovery | Recovery (Mana/Stam/Health) | 28 | 50 | **22** |
| Lore-Religion | Lores (13 lore skills) | 3 | 50 | **47** |
| Lore-Blessings | Lores (13 lore skills) | 0 | 50 | **50** |

**Total gap: 178 points across 5 goals (8 goal rows, 3 already capped).**

Note: Lore-Religion and Lore-Blessings are both in the Lores swap group but consume points independently. An item with +10 Summoning Lore can be swapped to Religion OR Blessings, not both. This nearly doubles the lore problem size compared to treating it as a single 47-point gap.

### Available Slots (14 total)
| Type | Count | Details |
|------|-------|---------|
| Open (no item) | 12 | ankle, back, belt, both_ears, chest_slipped, feet_slipped, fingers, legs_pulled, legs_slipped, neck, pin, shoulder_slung |
| Free replacement | 2 | wrist (pink topaz bracer, +4 WIS ≤ surplus 5), single_ear (empty earring) |
| **Total** | **14** | |

**NOT free (conditional):** head (crown +6 WIS > surplus 5), other single_ear (+4 WIS but surplus consumed after bracer), dreamstone pin (+5 WIS > remaining surplus). These require dynamic surplus evaluation — not yet implemented.

**Locked (13 slots):** hands, chest, shoulders_draped, waist, belt×2, feet_on, fingers, neck×3, pin×3, locus

### Nugget Slots (for casters)
Weapons, runestaffs, shields, and items in these worn positions require the 25M nugget service: `shoulders, chest, hands, feet_on, waist`. Nuggets include permanence — no additional pell needed.

### Exclusions
- Yakushi shop excluded (player preference)
- Bloodstone family items excluded (player already owns one; only one can be active)

## True Cost Formula

```
trueCost = itemPrice
  + (25M if slot is nugget)        — weapons/runestaffs/shields/armor slots
  + (10M if needs pell)            — non-permanent wearables only
  + (10M × numSwapsNeeded)         — enhancives not matching target ability
```

Swap cost example: An item with +10 SMC, +10 EMC, +10 MMC targeting Spirit MC scores 30 MC points. SMC is already correct (0 swaps), EMC and MMC each need a swap = 20M in swap fees.

**Note:** Swap costs are not yet included in the simulation results below. They will shift preference toward items whose abilities already match the target, reducing total spend.

## Scoring Formula

```python
# For each shop item candidate:
contributions = allocate_to_goals(item.enhancives, current_gaps)
weighted = sum(contribution[g] / remaining_gap[g] for g in contributions if gap[g] > 0)
value = weighted / log10(max(true_cost, 1000))^alpha
```

The proportional gap-fill numerator ensures items that close a large percentage of a gap score higher than items that add raw points to an already-small gap. The log10 cost denominator gently penalizes expensive items without creating a cliff — a 1M item gets divided by 6, a 100M item by 8.

### Alpha (User Preference)
| Setting | Alpha | Behavior |
|---------|-------|----------|
| Cash Flush | 1.0 | Weak cost penalty — willing to spend for best items |
| Balanced | 1.5 | Default — finds deals without obsessing over cost |
| Cash Adverse | 2.0 | Strong cost penalty — prefers cheap multi-goal wearables |

## Early Strategy Comparison (v1 — 16 slots, pre-constraint fixes)

Before discovering the slot classification bugs, we tested 5 strategies with 16 assumed slots. These results are historically interesting but **not accurate** — they overcount available slots and undercount costs.

| Strategy | Items | Cost | Fill % | Slots Left |
|----------|-------|------|--------|------------|
| 1. Hybrid (cheap→max) | 16 | 920K | 72% | 0 |
| 2. Multi-goal priority | 6 | 182.5M | 98% | 10 |
| 3. Largest gap first | 7 | 384M | 100% | 9 |
| 4. Balanced (proportional) | 8 | 803M | 100% | 8 |
| 5. Balanced + cost penalty | 9 | 129M | 100% | 7 |

Strategy 5 won decisively — best cost, full coverage, good slot efficiency. But the numbers were optimistic.

## Corrected Results (v7 — 14 slots, full constraint model)

After fixing slot classification (14 not 16), adding nugget costs (+25M), pell costs (+10M for non-permanent wearables), and dual lore goal allocation, the real picture emerges:

### Alpha 1.0 — Cash Flush (100% filled, 362M, 0 slots left)

| # | Score | Item | Base Cost | Extras | Total | Slot | Fill |
|---|-------|------|-----------|--------|-------|------|------|
| 1 | 24 | some full leather | 60M | nug+25M | 85M | nugget | Weapons:+24 |
| 2 | 16 | a mithril rapier | 875K | nug+25M | 25.9M | nugget | Weapons:+1, Recovery:+15 |
| 3 | 7 | a gleaming vaalorn aventail | 576K | perm | 576K | neck | Recovery:+7 |
| 4 | 22 | a smooth kakore runestaff | 5.6M | nug+25M | 30.6M | nugget | MC:+22 |
| 5 | 19 | a burled villswood runestaff | 1.3M | nug+25M | 26.3M | nugget | Lore-Ble:+8, MC:+11 |
| 6 | 2 | an elegant pink sapphire earcuff | 50K | perm | 50K | single_ear | Lore-Rel:+1, MC:+1 |
| 7 | 16 | a birch-handled glaes handaxe | 10M | nug+25M | 35M | nugget | Lore-Rel:+16 |
| 8 | 14 | a well-balanced rowan runestaff | 15M | nug+25M | 40M | nugget | Lore-Ble:+14 |
| 9 | 14 | a flimsy kakore runestaff | 15M | nug+25M | 40M | nugget | Lore-Rel:+14 |
| 10 | 13 | an acid-stained mossbark runestaff | 1M | nug+25M | 26M | nugget | Lore-Ble:+13 |
| 11 | 13 | an ancient vultite longsword | 1M | nug+25M | 26M | nugget | Lore-Rel:+13 |
| 12 | 13 | a mauve kakore runestaff | 2M | nug+25M | 27M | nugget | Lore-Ble:+13 |
| 13 | 3 | a serpentine pink topaz barrette | 100K | perm | 100K | pin | Lore-Rel:+3 |
| 14 | 2 | a pink pearl studded gold bracelet | 35K | perm | 35K | wrist | Lore-Ble:+2 |

### Alpha 1.5 — Balanced (99% filled, 304M, 1 slot left)

| # | Score | Item | Base Cost | Extras | Total | Slot | Fill |
|---|-------|------|-----------|--------|-------|------|------|
| 1 | 26 | a silver-hilted glaes longsword | 1.5M | nug+25M | 26.5M | nugget | Weapons:+11, MC:+15 |
| 2 | 25 | a scorched faewood runestaff | 6.5M | nug+25M | 31.5M | nugget | Weapons:+7, Recovery:+4, MC:+14 |
| 3 | 9 | a gleaming ora aventail | 375K | perm | 375K | neck | MC:+4, Weapons:+5 |
| 4 | 13 | a beech-handled mithril skull-crusher | 1M | nug+25M | 26M | nugget | Weapons:+2, Recovery:+2, Lore-Ble:+8, MC:+1 |
| 5 | 15 | a mithril rapier | 875K | nug+25M | 25.9M | nugget | Recovery:+15 |
| 6 | 4 | a plain blue sapphire brooch | 150K | perm | 150K | pin | Recovery:+1, Lore-Rel:+3 |
| 7 | 16 | a birch-handled glaes handaxe | 10M | nug+25M | 35M | nugget | Lore-Rel:+16 |
| 8 | 14 | a well-balanced rowan runestaff | 15M | nug+25M | 40M | nugget | Lore-Ble:+14 |
| 9 | 14 | a flimsy kakore runestaff | 15M | nug+25M | 40M | nugget | Lore-Rel:+14 |
| 10 | 13 | an acid-stained mossbark runestaff | 1M | nug+25M | 26M | nugget | Lore-Ble:+13 |
| 11 | 13 | an ancient vultite longsword | 1M | nug+25M | 26M | nugget | Lore-Ble:+13 |
| 12 | 13 | a mauve kakore runestaff | 2M | nug+25M | 27M | nugget | Lore-Rel:+13 |
| 13 | 2 | a pink pearl studded gold bracelet | 35K | perm | 35K | wrist | Lore-Ble:+2 |

Misses Lore-Religion by 1 point. 1 slot unused.

### Alpha 2.0 — Cash Adverse (97% filled, 292M, 0 slots left)

| # | Score | Item | Base Cost | Extras | Total | Slot | Fill |
|---|-------|------|-----------|--------|-------|------|------|
| 1 | 26 | a silver-hilted glaes longsword | 1.5M | nug+25M | 26.5M | nugget | Weapons:+11, MC:+15 |
| 2 | 25 | a scorched faewood runestaff | 6.5M | nug+25M | 31.5M | nugget | Weapons:+7, Recovery:+4, MC:+14 |
| 3 | 9 | a gleaming ora aventail | 375K | perm | 375K | neck | MC:+4, Weapons:+5 |
| 4 | 2 | an elegant pink sapphire earcuff | 50K | perm | 50K | single_ear | Lore-Ble:+1, MC:+1 |
| 5 | 2 | a beryl-inset copper clasp | 50K | perm | 50K | pin | Weapons:+2 |
| 6 | 15 | a mithril rapier | 875K | nug+25M | 25.9M | nugget | Recovery:+15 |
| 7 | 3 | a malachite and beryl bracer | 250K | perm | 250K | wrist | Recovery:+3 |
| 8 | 16 | a birch-handled glaes handaxe | 10M | nug+25M | 35M | nugget | Lore-Ble:+16 |
| 9 | 14 | a well-balanced rowan runestaff | 15M | nug+25M | 40M | nugget | Lore-Rel:+14 |
| 10 | 14 | a flimsy kakore runestaff | 15M | nug+25M | 40M | nugget | Lore-Rel:+14 |
| 11 | 13 | an acid-stained mossbark runestaff | 1M | nug+25M | 26M | nugget | Lore-Ble:+13 |
| 12 | 13 | an ancient vultite longsword | 1M | nug+25M | 26M | nugget | Lore-Ble:+13 |
| 13 | 13 | a mauve kakore runestaff | 2M | nug+25M | 27M | nugget | Lore-Rel:+13 |
| 14 | 7 | a pearl inset pewter band | 3M | pell+10M | 13M | fingers | Lore-Ble:+7 |

Misses Lore-Religion by 6 points. Fills all 14 slots.

## Results Summary (v7 — Corrected)

| Alpha | Setting | Items | Total Cost | Fill % | Slots Left | Nuggets | Pells |
|-------|---------|-------|------------|--------|------------|---------|-------|
| 1.0 | Cash Flush | 14 | 362M | 100% | 0 | 10 | 0 |
| 1.5 | Balanced | 13 | 304M | 99% | 1 | 10 | 0 |
| 2.0 | Cash Adverse | 14 | 292M | 97% | 0 | 9 | 1 |

### Key Observations

1. **Lore goals dominate the problem.** 8-10 of 14 slots are consumed by lore-carrying runestaffs and weapons regardless of alpha. This is because lore enhancives are rare on wearable items — they almost exclusively appear on held items requiring the 25M nugget service.

2. **Nugget costs are the real expense.** Base item prices are often 1-15M, but the 25M nugget fee makes every held item cost 26-40M. The algorithm correctly identifies cheap-base-price runestaffs (1M base + 25M nugget = 26M total) over expensive ones (15M base + 25M nugget = 40M total).

3. **Alpha 1.5 (Balanced) leaves 1 point on the table** but saves 58M over Cash Flush and keeps a slot open for future flexibility. This is likely the best default for most players.

4. **Alpha 2.0 (Cash Adverse) saves 70M over Cash Flush** but misses 6 Lore-Religion points. The strong cost penalty causes it to pick cheap low-score wearables (50K earcuff for +2, 50K clasp for +2) that consume slots without meaningful gap closure.

5. **Swap costs (not yet modeled) will increase totals by 50-100M.** Most nugget items carry abilities like "Elemental Lore - Fire" that need swapping to Religion or Blessings at 10M per swap. An item with 3 lore enhancives needing swaps adds 30M on top of the 25M nugget.

## What's Not Yet Modeled

1. **Sylinara swap costs** — 10M per ability swap within a group. Will shift preference toward items whose abilities already match the target.

2. **Inventory replacement evaluation** — The engine only fills open slots. It never considers whether replacing an existing item with a better shop item would produce a net positive across all goals.

3. **Dynamic surplus tracking** — Slots classified as "conditional" (crown, earcuff, dreamstone pin) should be re-evaluated each round as surpluses change from prior picks.

4. **Stop threshold** — A 95% fill option would let the engine skip expensive tail-end items closing tiny gaps (e.g., the last 1-6 lore points).

5. **Swatch costs** — 25M to convert an item to a different slot type (not modeled).

## Recommendation

**Strategy 5 (Balanced + Cost Penalty) with alpha=1.5** remains the recommended default.

The formula `proportional_gap_fill / log10(cost)^alpha` naturally produces the behavior we want:

- **Cheap items are preferred when they make meaningful proportional dents** — a 375K aventail filling 9/34 MC scores well because log10(375K) is small
- **Expensive items are chosen when they're the only way to close a gap** — lore runestaffs at 26-40M are picked because nothing cheaper carries lore
- **Absurdly expensive items are avoided** — the 500M sword from early testing gets killed by log10(500M)^1.5
- **Multi-goal items naturally score well** — the scorched faewood runestaff hits 4 goals simultaneously, earning a high proportional score
- **Slot efficiency is preserved** — 13 items instead of 14, leaving room for future purchases

### Next Steps
1. Add swap costs to true cost calculation
2. Implement inventory replacement evaluation
3. Translate proven algorithm to TypeScript for production
4. Build recommendation UI with alpha slider and shopping list display
