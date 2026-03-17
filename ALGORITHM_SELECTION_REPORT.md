# Enhancive Shopping Engine — Algorithm Selection Report

## Problem Statement

GemStone IV's enhancive system allows players to wear items that boost their character's stats and skills. The **Enhancive Shopper** tool tracks ~5,700 items across all player shops and helps users find items that match their goals.

The core challenge: given a character's current inventory, a set of goals with target values, and a database of available shop items — **recommend the best set of purchases to fill the gaps between current totals and targets.**

This is complicated by several constraints:

1. **Swap groups** — GemStone's enhancive swap service treats certain abilities as fungible. For example, Edged Weapons, Blunt Weapons, Spell Aiming, and 5 other weapon skills are all interchangeable. An item with +8 Blunt Weapons counts toward a Spell Aiming goal. There are 8 swap groups covering stats, skills, lores, mana controls, and recovery.

2. **Slot limits** — Characters have a finite number of equipment slots (head, neck, wrist, pin, etc.). Some slots are occupied by locked items (armor, functional gear) that cannot be replaced.

3. **Replacement cascade** — Replacing an existing item affects ALL goals, not just the target goal. A crown with +6 Wisdom replaced by a helm with +10 Mana Control gains MC but may break the Wisdom target.

4. **Nugget costs** — Weapons and runestaffs require a 25M silver "nugget" service to convert them into wearable enhancive items, significantly increasing their true cost.

5. **Budget vs. completeness tradeoff** — Cheap items exist but carry small boosts. Expensive items carry large boosts. A pure budget approach can't close certain gaps (Mana Controls barely exists on cheap items). A pure "best score" approach overspends dramatically.

This is a variant of the **Multi-Dimensional Knapsack Problem** — NP-hard in general, but tractable for our instance due to small goal counts and bounded slot limits.

## Test Case: Mejora (Hunting Set)

### Current Goal Status
| Goal | Swap Group | Current | Target | Gap |
|------|-----------|---------|--------|-----|
| Wisdom | Stat A (STR/WIS/AUR) | 45 | 40 | 0 (over by 5) |
| Discipline | Stat B (CON/DEX/AGI/DIS) | 40 | 40 | 0 (capped) |
| Logic | Stat C (LOG/INT/INF) | 40 | 40 | 0 (capped) |
| Mana Controls | MC (Ele/Spi/Men MC) | 16 | 50 | **34** |
| Spell Aiming | Weapons (8 weapon skills) | 25 | 50 | **25** |
| Recovery | Recovery (Mana/Stam/Health) | 28 | 50 | **22** |
| Lores | Lores (13 lore skills) | 3 | 50 | **47** |

**Total gap: 128 points across 4 skill goals.**

### Available Slots
- 12 open slots (no item equipped)
- 4 "free" replacement slots (items contributing only to over-cap Wisdom goal — replacing them loses nothing)
- **16 total slots** to work with

### Exclusions
- Yakushi shop excluded (player preference)
- Bloodstone family items excluded (player already owns one; only one can be active)

## Strategies Tested

We implemented 5 different greedy algorithms, each using the same swap-group-aware scoring function but different item selection criteria. All strategies re-score items after each pick to account for shrinking gaps.

### Strategy 1: Hybrid (Cheap Wins → Max Score)
**Logic:** Pick items above an efficiency threshold (30 points/million silver) first, then switch to raw score for remaining gaps.

| # | Item | Cost | Gap Fill |
|---|------|------|----------|
| 1 | ornate hoarbeam shield | 50K | Lores:+4, Recovery:+5 |
| 2 | petal-cut red sunstone torc | 50K | Recovery:+3, Weapons:+5 |
| 3 | onyx-inlaid copper bracelet | 20K | Lores:+3 |
| 4 | glyph-etched silver crown | 20K | Weapons:+3 |
| 5 | nicked villswood shield | 45K | Lores:+6 |
| 6 | vaalorn aegis | 55K | Recovery:+7 |
| 7 | ivory-inlaid pink topaz necklace | 50K | Recovery:+5 |
| 8 | turquoise-set copper torc | 40K | Lores:+4 |
| 9 | chased sterling silver talisman | 75K | Weapons:+3, Lores:+4 |
| 10 | blackened vultite arm greaves | 100K | Lores:+8 |
| 11 | embossed spiked mesille aegis | 100K | Lores:+6, Recovery:+2 |
| 12 | moonstone inset copper buckle | 75K | MC:+3, Lores:+3 |
| 13 | rune-etched mithril torc | 50K | Weapons:+4 |
| 14 | mithril and bloodjewel medallion | 50K | Lores:+4 |
| 15 | rune-etched pewter earcuff | 40K | MC:+3 |
| 16 | embossed vultite aventail | 100K | Weapons:+7 |

**Result: 16 items, 920K silver, 72% filled.** Recovery closed. MC barely touched (28 remaining). All 16 slots consumed — no room to fix MC later. The cheap-first approach burns slots on low-value items and can't reach premium enhancives.

---

### Strategy 2: Multi-Goal Priority
**Logic:** Prefer items that hit 2 or more gap goals simultaneously. Tiebreak by total score, then cost.

| # | Item | Cost | Gap Fill |
|---|------|------|----------|
| 1 | beech-handled mithril skull-crusher | 26M | Weapons:+8, Recovery:+2, Lores:+8, MC:+4 |
| 2 | well-balanced rowan runestaff | 40M | Weapons:+8, Lores:+14, MC:+5 |
| 3 | scorched faewood runestaff | 31.5M | Weapons:+7, Recovery:+4, MC:+14 |
| 4 | glaes rapier | 28M | MC:+11, Lores:+6, Recovery:+3 |
| 5 | elegant mossbark runestaff | 27M | Lores:+11, Recovery:+5, Weapons:+2 |
| 6 | veniom-hilted vultite longsword | 30M | Recovery:+6, Lores:+8 |

**Result: 6 items, 182.5M silver, 98% filled.** Only misses Recovery by 2 points. Excellent slot efficiency (10 slots remaining). But expensive — every item requires a 25M nugget.

---

### Strategy 3: Largest Gap First
**Logic:** Each round, identify the goal with the biggest remaining gap and find the item with the best contribution to that specific goal.

| # | Item | Cost | Gap Fill |
|---|------|------|----------|
| 1 | birch-handled glaes handaxe | 35M | Lores:+16, Recovery:+1 |
| 2 | smooth kakore runestaff | 30.6M | MC:+22 |
| 3 | polished mithglin helm | 100M | Lores:+15, Weapons:+4 |
| 4 | some full leather | 60M | Weapons:+21 |
| 5 | monir-hafted imflass awl-pike | 92.5M | Recovery:+16 |
| 6 | well-balanced rowan runestaff | 40M | Lores:+14, MC:+5 |
| 7 | silver-capped hoarbeam runestaff | 26M | MC:+7, Recovery:+5, Lores:+2 |

**Result: 7 items, 384M silver, 100% filled.** Achieves full coverage but overspends — picks expensive single-purpose items (100M helm for Lores, 92.5M awl-pike for Recovery alone).

---

### Strategy 4: Balanced Fill (Proportional)
**Logic:** Score each item by the sum of `(contribution / remaining_gap)` for each goal it fills. This prioritizes items that make the biggest proportional dent — filling 10/34 of MC (29%) scores higher than filling 10/47 of Lores (21%).

| # | Item | Cost | Gap Fill |
|---|------|------|----------|
| 1 | damascened blued ghezyte short sword | 525M | Recovery:+12, Weapons:+11 |
| 2 | glaes-edged mithglin flamberge | 41M | Weapons:+13, Recovery:+8 |
| 3 | scorched faewood runestaff | 31.5M | Weapons:+1, Recovery:+2, MC:+14 |
| 4 | smooth kakore runestaff | 30.6M | MC:+20 |
| 5 | birch-handled glaes handaxe | 35M | Lores:+16 |
| 6 | polished mithglin helm | 100M | Lores:+15 |
| 7 | well-balanced rowan runestaff | 40M | Lores:+14 |
| 8 | onyx-inlaid copper bracelet | 20K | Lores:+2 |

**Result: 8 items, 803M silver, 100% filled.** Proportional scoring works well conceptually but has no cost awareness — it picked a 500M sword as its first item because it filled two gaps proportionally well.

---

### Strategy 5: Balanced + Cost Penalty ⭐
**Logic:** Same proportional gap-fill scoring as Strategy 4, but divided by `log10(cost)`. This gently penalizes expensive items without ignoring them. A 1M item gets divided by 6, a 100M item by 8 — a soft curve, not a cliff.

| # | Item | Cost | Gap Fill |
|---|------|------|----------|
| 1 | some full leather | 60M | Weapons:+24 |
| 2 | engraved mithril pin | 1M | Recovery:+9, MC:+2, Weapons:+1 |
| 3 | polished yew heavy crossbow | 300K | Lores:+3, Recovery:+12 |
| 4 | ornate hoarbeam shield | 50K | Lores:+4, Recovery:+1 |
| 5 | smooth kakore runestaff | 30.6M | MC:+22 |
| 6 | step-cut chrysoberyl torc | 875K | MC:+10, Lores:+4 |
| 7 | birch-handled glaes handaxe | 35M | Lores:+16 |
| 8 | topaz-inset pewter bracelet | 1.5M | Lores:+12 |
| 9 | blackened vultite arm greaves | 100K | Lores:+8 |

**Result: 9 items, 129M silver, 100% filled.** All gaps closed. 7 slots remaining for future flexibility. Mixes cheap items (50K shield, 300K crossbow) with targeted expensive items (30.6M runestaff for MC, 35M handaxe for Lores) only where needed.

## Results Summary

| Strategy | Items | Cost | Fill % | Slots Left |
|----------|-------|------|--------|------------|
| 1. Hybrid (cheap→max) | 16 | 920K | 72% | 0 |
| 2. Multi-goal priority | 6 | 182.5M | 98% | 10 |
| 3. Largest gap first | 7 | 384M | 100% | 9 |
| 4. Balanced (proportional) | 8 | 803M | 100% | 8 |
| **5. Balanced + cost penalty** | **9** | **129M** | **100%** | **7** |

## Recommendation

**Strategy 5 (Balanced + Cost Penalty)** is the recommended default algorithm for the engine.

The formula `proportional_gap_fill / log10(cost)` naturally produces the behavior we want:

- **Cheap items are preferred when they make meaningful proportional dents** — a 50K shield filling 4/47 Lores still scores well because log10(50K) is small
- **Expensive items are chosen when they're the only way to close a gap** — the 30.6M kakore runestaff fills 22/34 MC (65%) and nothing cheaper comes close
- **Absurdly expensive items are avoided** — the 500M sword from Strategy 4 gets killed by log10(500M) = 8.7
- **Slot efficiency is preserved** — 9 items instead of 16, leaving room for future purchases or goal changes
- **Multi-goal items naturally score well** — proportional fill across 2-3 gaps stacks up, giving multi-goal items an edge without an explicit preference

### Future Enhancements
- User-selectable strategy mode (budget/balanced/aggressive)
- Replacement cascade analysis for conditional slot swaps
- Unique item family detection (bloodstone set, etc.)
- Diminishing returns modeling for skill ranks
