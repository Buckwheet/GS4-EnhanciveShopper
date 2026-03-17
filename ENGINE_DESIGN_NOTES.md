# Engine Design Notes — Learned from Mejora Shopping Simulation

## Core Algorithm Observations

### 1. Scoring Function: `scoreItem(enhancives, currentGaps)`
```
for each enhancive on item:
  baseAbility = normalize(enhancive.ability)  // strip Bonus/Ranks/Base
  group = getSwapGroup(baseAbility)           // lookup in SWAP_GROUPS map
  if group exists AND group is in user's goals AND gap[group] > 0:
    effective = (ability == "Health Recovery") ? boost/2 : boost
    contribution[group] += effective

score = sum( min(contribution[g], gap[g]) for each g )
```

Key insight: **cap contribution at remaining gap**. An item with +22 MC is only worth 12 if the MC gap is 12.

### 2. Two Ranking Strategies Needed

**Strategy A: Maximum Score (greedy by raw score)**
- Best for: "I have money, fill my gaps fastest"
- Result: 6 items, 530M silver, 100% gap fill
- Picks expensive multi-goal items first

**Strategy B: Maximum Efficiency (greedy by score/cost)**
- Best for: "I'm on a budget, best bang for buck"
- Result: 12 items, 680K silver, 58% gap fill (Recovery fully closed)
- Picks cheap items with decent scores
- Runs out of open slots before closing MC gap (cheap items don't have MC)

**Strategy C (not yet built): Hybrid**
- Fill cheap wins first (efficiency > threshold)
- Then switch to raw score for remaining gaps
- This is probably the best UX default

### 3. Slot Awareness Matters
- Budget path used 12 items = all open slots consumed
- Still had MC:31, Weapons:14, Lores:9 remaining
- To close those, would need REPLACEMENTS (cascade analysis required)
- The greedy-by-score path only needed 6 items — leaves 6 open slots for future

### 4. Nugget Cost is a Major Factor
- Items without a `worn` slot need a nugget (25M silver) to equip
- This makes cheap weapons (50K) actually cost 25.05M when nuggeted
- The budget algorithm correctly avoids nugget items because their TRUE cost is 25M+
- Wearable items (neck, head, pin, etc.) are much more cost-efficient

### 5. Re-scoring After Each Pick is Critical
- After buying +22 MC item, MC gap drops from 34 to 12
- Next MC item scored against gap=12, not gap=34
- This prevents over-buying in one category while ignoring others
- Without re-scoring, greedy would stack 3 MC items and ignore Lores

### 6. The "Minimum Score" Filter
- Budget mode needs `score >= 3` minimum to avoid buying +1 junk items
- Could also use `gap_fill_pct >= 5%` as threshold
- Items filling <5% of any gap are noise

## Data Flow for Engine Implementation

```
User loads page
  → fetch inventory (set_inventory)
  → fetch goals (set_goals with target_total)
  → compute currentTotals per swap group from inventory
  → compute gaps = target - currentTotal per goal
  
User views shop items
  → for each item: score = scoreItem(item.enhancives, gaps)
  → sort by score desc (or efficiency)
  → display with gap-fill breakdown

User clicks "Build Shopping List"
  → run greedy algorithm (re-scoring after each pick)
  → show ordered list with running gap totals
  → show total cost including nugget fees
```

## What the Apron Analysis Proved

The replacement cascade check works:
- Apron contributes +8 Stat C (Logic) and +8 Weapons
- Logic is at exactly 40 (cap) — removing apron breaks it
- Engine correctly flags: "replacement must provide ≥8 Stat C"
- This is the `netImpact = newContribution - lostContribution` check per goal

## Replacement/Swap Strategy for Engine Code

### Step 1: Classify Every Inventory Item's Replaceability

For each item in user's inventory, compute a `replaceCost` — what goals lose if removed:

```
for each item in inventory:
  if item.is_locked: skip (never replaceable)
  
  lossByGroup = {}
  for each enhancive on item:
    group = getSwapGroup(enhancive.ability)
    if group and group in userGoals:
      lossByGroup[group] += effective_boost
  
  // Check each loss against current surplus
  replaceCost = 0
  breaksGoal = false
  for group, loss in lossByGroup:
    surplus = currentTotal[group] - target[group]
    if surplus >= loss:
      // Removing this item still leaves goal met — FREE to replace
      replaceCost += 0
    else if surplus >= 0:
      // Removing drops below target by (loss - surplus)
      // Replacement MUST compensate this amount in same group
      replaceCost += (loss - surplus)
      breaksGoal = true
    else:
      // Already below target — removing makes gap worse but doesn't "break" anything new
      replaceCost += loss  // still counts as cost since gap widens
  
  item.replaceCategory = breaksGoal ? "conditional" : (replaceCost == 0 ? "free" : "gap-widening")
  item.compensationRequired = lossByGroup where surplus < loss
```

### Step 2: Three Replacement Categories

1. **FREE replacements** — item contributes only to over-cap goals (e.g., Wisdom items when Wisdom is 45/40). Swap with zero risk. These are equivalent to open slots.

2. **Conditional replacements** — item contributes to an at-cap goal (e.g., apron's +8 Logic when Logic is exactly 40). Replacement MUST provide ≥ compensation in that group. Engine must enforce: `newItem.groupContrib[g] >= item.compensationRequired[g]` for ALL groups.

3. **Gap-widening replacements** — item contributes to a below-target goal. Replacing makes an existing gap worse. Only worth it if the new item provides MORE to that same group, or fills a higher-priority gap.

### Step 3: Scoring Replacements

When evaluating a shop item as a replacement for an inventory item:

```
netScore = 0
for each goal group:
  gained = shopItem.groupContrib[group]    // what new item adds
  lost = inventoryItem.groupContrib[group] // what old item provided
  net = gained - lost
  
  // Check constraint: would this break a currently-met goal?
  if currentTotal[group] >= target[group] AND (currentTotal[group] + net) < target[group]:
    REJECT — this replacement breaks a met goal
  
  // Only count positive net toward gap goals
  if gap[group] > 0:
    netScore += min(max(0, net), gap[group])
```

### Step 4: What Mejora's Data Proved

**Free replacements found:**
- `enruned pink topaz bracer` (wrist): +4 Wisdom → over cap, free slot
- `jade-inlaid pink dreamstone pin` (pin): +5 Wisdom → over cap, free slot  
- `flame-cut white starstone earcuff` (single_ear): +4 Wisdom → over cap, free slot
- `round-cut firestone earring` (single_ear): no enhancives → free slot

These 4 items give Mejora 16 slots instead of 12. The Wisdom surplus is 45-40=5, so she can lose up to 5 Wisdom total before it matters. Losing all 3 Wisdom items (-13) would break it, but the engine handles this: after "freeing" the first item (-4, surplus drops to 1), the second item (-5) would be reclassified as "conditional" on re-evaluation.

**Key insight: re-evaluate replaceability after each swap decision.** The surplus changes as you remove items. This is why the greedy loop must re-score AND re-classify after each pick.

### Step 5: Integration with Greedy Algorithm

```
for each round:
  availableSlots = openSlots + freeReplacementSlots(currentSurpluses)
  
  for each candidate shopItem:
    // Score for open slot placement (pure gain)
    openScore = scoreItem(shopItem, currentGaps)
    
    // Score for each replaceable inventory item
    for each replaceableItem:
      netScore = scoreReplacement(shopItem, replaceableItem, currentGaps, currentTotals)
      if netScore > openScore:
        bestPlacement = {replace: replaceableItem, score: netScore}
    
    // Track best overall option
    bestCandidate = max(openScore, bestReplacementScore)
  
  pick bestCandidate
  update gaps, totals, inventory
  // FREE replacements may change — re-classify next round
```

## Slot Types Encountered in Shop Data
- `nugget` — weapon/runestaff, needs nugget service (25M) to wear
- `neck` — necklace/torc/pendant, wearable
- `head` — crown/helm, wearable  
- `pin` — stickpin/brooch, wearable
- `wrist` — bracelet/bracer, wearable
- `fingers` — ring/band, wearable
- `shoulders` — shield/bow (shoulder_slung), wearable
- `legs` — leg greaves, wearable
- `arms` — arm greaves, wearable
- `chest` — armor, wearable (but Mejora's chest is LOCKED)
