# DecisionBrain.md — Enhancive Recommendation Engine Logic

This document captures the core reasoning and rules the recommendation engine must follow, derived from hands-on analysis of real character data (Mejora, set_id=4, Hunting set).

---

## The Fundamental Problem

Users don't want a search engine. They want the system to answer: **"What should I buy next, and why?"**

The current goal system requires users to manually approximate what the engine should figure out automatically. A user setting "lore +15" is doing the engine's job — they're encoding swap group awareness, rarity thresholds, and gap analysis into a crude free-text filter.

---

## Swap Groups Are Everything

GemStone IV merchant services allow enhancives within the same group to be swapped to any other member. This makes all members of a group **fungible**. The engine must treat them as a single pool.

### Swap Group Definitions

| Group | Members |
|-------|---------|
| Stat A | Strength, Wisdom, Aura |
| Stat B | Constitution, Dexterity, Agility, Discipline |
| Stat C | Logic, Intuition, Influence |
| Weapons | Edged, Blunt, Ranged, Thrown, Polearm, Two-Handed, Brawling, Spell Aiming (EXCLUDES: TWC, MOC, Combat Maneuvers) |
| MIU/AS | Magic Item Use, Arcane Symbols |
| Mana Controls | Elemental MC, Spirit MC, Mental MC |
| Lores | ALL lores — Elemental (Air/Earth/Fire/Water), Spiritual (Blessings/Religion/Summoning), Sorcerous (Demonology/Necromancy), Mental (Manipulation/Telepathy/Transference/Transformation) |
| Recovery | Mana Recovery, Stamina Recovery, Health Recovery (health at **1/2 value**) |

Each group applies to Base, Bonus, AND Ranks variants.

### What This Means For Scoring

An item with +5 Fire Lore, +2 Air Lore, +7 Blessings Lore, +1 Summoning Lore = **+15 lore ranks** toward ANY single lore goal. They're all swappable.

An item with +10 Elemental MC and +10 Spirit MC = **+20 mana control** toward any MC goal.

The current matcher checks individual enhancive boosts. It would never find the +15 lore item above because no single enhancive hits +15. **The engine must sum across the swap group per item.**

### Standalone Abilities (No Swap Group)

These are NOT swappable and must be matched exactly:
- Max Health, Max Mana, Max Stamina, Max Spirit
- Spirit Recovery (NOT in Recovery group — that's Mana/Stamina/Health Recovery)
- Dodging, Physical Fitness, Climbing, Swimming, First Aid
- Stalking and Hiding, Perception, Picking Locks, Disarming Traps, Pickpocketing
- Harness Power, Armor Use, Shield Use, Survival, Trading
- Combat Maneuvers, Multi Opponent Combat, Two Weapon Combat
- Ambush

---

## Goal Model: Target-Based, Not Threshold-Based

### Current (broken)
User creates: `stat: "lore", min_boost: 15`
- User must understand swap groups
- User must manually pick a threshold
- System checks individual enhancive boosts, misses multi-enhancive items

### Correct
User creates: `ability: "Spiritual Lore - Blessings", target: 50`
- System resolves "Blessings" → Lores swap group
- System sums ALL lore enhancives across inventory = current total
- Gap = target - current total
- System scans shop items, sums all lore enhancives per item = item contribution
- Recommends items that fill the gap efficiently
- **No min_boost needed** — the engine determines what's worth alerting on based on gap fill significance

### Caps
- Stats (Base/Bonus): 40
- Skills (Bonus/Ranks): 50

---

## Slot Constraints Are Non-Negotiable

The engine MUST check slot availability before recommending anything. Three categories:

### 1. Open Slots
Slot has capacity remaining. Item can be equipped directly. No extra cost.

### 2. Replaceable Slots
Slot is full but contains enhancive items that aren't locked/irreplaceable. The engine can recommend replacing an existing item IF the new item provides better goal coverage. **But it must account for what is lost** (see below).

### 3. Locked/Full Slots
Slot is occupied by locked items (armor, functional gear) with no remaining capacity. Item cannot go here. Must be nuggeted or swatched to a different slot.

### Nuggets and Swatches
- **Nugget** (25M): Converts a non-wearable item (weapon/runestaff) into a slot-agnostic enhancive. Goes into any open slot.
- **Swatch** (25M): Moves a wearable item's enhancives to a different slot. Use when item is in a full/locked slot but has valuable enhancives.
- These costs must be factored into total item cost.

---

## The Replacement Cascade Problem

**This is the hardest part of the engine.**

When the engine recommends replacing an existing item, it must evaluate the **full system impact across ALL goals**, not just the target goal.

### Real Example (Mejora)

**State:**
- Wisdom (Stat A): 45/40 ✓ (5 over cap)
- Mana Control: 16/50 ✗ (need 34)
- Spell Aiming (Weapons): 25/50 ✗ (need 25)

**Candidate:** Replace `jade-inlaid white starstone crown` (head, +6 Wisdom, +2 AS Ranks) with `ornate mithril greathelm` (head, +10 Spirit MC, +6 Spell Aiming)

**Naive analysis:** +16 toward MC/WA goals. Great!

**Correct analysis:** Losing the crown drops Wisdom from 45 → 39. Wisdom goal is 40. **This breaks the Wisdom goal.** The recommendation is invalid unless paired with a way to recover +1 Stat A somewhere else.

### Rule: Every Replacement Must Be Evaluated As A System-Wide Transaction

For every item swap, the engine must:
1. Calculate the LOSS across all goals (what the removed item contributed, using swap groups)
2. Calculate the GAIN across all goals (what the new item contributes)
3. Check if any currently-met goal drops below target
4. If a goal breaks, either:
   - Reject the recommendation
   - Bundle it with a companion item that recovers the deficit
   - Flag it: "This gains +16 MC/WA but requires +1 Stat A elsewhere"

---

## Recommendation Ranking

When presenting items to the user, rank by:

1. **Net goal impact** — total contribution across ALL goals minus any losses from replacement
2. **Goals broken** — items that break zero existing goals rank higher
3. **Total cost** — item price + nugget/swatch fee if applicable
4. **Efficiency** — net contribution per silver spent
5. **Permanence** — permanent items preferred over temporary
6. **Slot value** — prefer using "cheap" slots (ankle, belt, pin) over "expensive" slots (neck, fingers) that might be needed for multi-stat items later

---

## Alert Threshold Logic

Instead of user-defined min_boost, alerts should fire based on gap significance:

```
gap_fill_pct = item_group_contribution / remaining_gap
```

- High significance (>= 30% of gap): Immediate Discord DM alert
- Medium significance (>= 15% of gap): Show in recommendations, no DM
- Low significance (< 15%): Available in search but not highlighted

Thresholds could be user-configurable. The point is the USER never has to set "+15" — the engine knows the gap and decides what's worth surfacing.

---

## Data The Engine Needs

For each recommendation request:

1. **Character's goals** — ability + target for each
2. **Full inventory** — every item, every slot, every enhancive, locked/irreplaceable flags
3. **Slot limits** — based on account type (F2P/Premium/Platinum)
4. **Current totals per goal** — calculated from inventory using swap group summing
5. **Gaps per goal** — target - current total
6. **All available shop items** — with enhancives, worn slot, cost, permanence

---

## What The Current Display Gets Right (And Wrong)

### Accidentally Correct
- Match Sum column sums individual enhancive boosts that match goal substrings. Because "mana control" matches both EMC and SMC on the same item, the displayed sum happens to equal the swap-group-aware total. This works by coincidence, not design.

### Wrong
- Goals use free-text substring matching instead of swap group resolution
- min_boost checks individual enhancives, not group sums per item
- No gap awareness — can't tell user "you need 34 more MC"
- No slot constraint checking in recommendations
- No replacement impact analysis
- No automatic alert thresholds

---

## Implementation Priority

1. **Swap group constants and resolution functions** — foundation for everything
2. **Inventory gap calculator** — sum current totals per goal using swap groups
3. **Item scoring with group sums** — score shop items by group contribution, not individual boost
4. **Slot-aware filtering** — only recommend items that can actually be equipped
5. **Replacement impact analysis** — check all goals when swapping items
6. **Target-based goal UI** — dropdown of abilities, target field, system resolves swap group
7. **Gap-based alert thresholds** — replace min_boost with automatic significance detection

---

*Derived from analysis session 2026-03-16. Based on Mejora's Hunting set (set_id=4) with real inventory and shop data.*
