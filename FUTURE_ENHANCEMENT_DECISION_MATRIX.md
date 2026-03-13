# Future Enhancement: Intelligent Goal Optimization & Decision Matrix

## Current State (As of March 13, 2026)

### How Goals Work Now
- User creates a goal: "Strength" with min_boost: 10
- System finds items with 10+ Strength (Base or Bonus)
- User manually decides which items to buy
- No automatic optimization or total calculation

### Current Limitations
1. **No Total Target**: Can't say "I want 20 total Strength across all items"
2. **No Base vs Bonus Logic**: System doesn't know Base is better than Bonus
3. **No Slot Optimization**: Doesn't calculate best slot for cost/benefit
4. **No Set Building**: Doesn't build complete sets to reach targets
5. **Manual Decision Making**: User must evaluate all recommendations manually

## Future Vision: Smart Goal System

### User Intent: "Strength 20"
When a user says "Strength 20", they mean:
- **"Build me a set of enhancives that provides 20 total Strength"**
- NOT "Find me a single item with +20 Strength"

### What the System Should Do

#### 1. Understand Stat Types
```
Strength Base > Strength Bonus
- Base: Adds to base stat (better, more expensive)
- Bonus: Adds to bonus (cheaper, less effective)
- System should prefer Base unless budget constrained
```

#### 2. Calculate Current Total
```
User's Current Inventory:
- Item A: +5 Strength Base
- Item B: +3 Strength Bonus
- Total: 8 Strength
- Gap to Goal: 20 - 8 = 12 needed
```

#### 3. Build Optimal Set
```
Decision Matrix:
1. Check available slots (what's not occupied)
2. Find items that fill gap (need 12 more)
3. Optimize for:
   - Cost (cheapest combination)
   - Permanence (prefer permanent items)
   - Slot efficiency (use slots wisely)
   - Base vs Bonus (prefer Base)
```

#### 4. Recommend Complete Solution
```
"To reach 20 Strength, buy these 3 items:"
1. Pin slot: +8 Strength Base (50k silvers, permanent)
2. Neck slot: +4 Strength Base (200k silvers, temporary)
3. Total cost: 250k silvers
4. Result: 8 (current) + 12 (new) = 20 Strength ✓
```

## Decision Matrix Components

### Priority Factors (in order)
1. **Reach Target**: Does combination reach the goal?
2. **Cost**: What's the total cost?
3. **Permanence**: Prefer permanent over temporary
4. **Stat Type**: Prefer Base over Bonus
5. **Slot Efficiency**: Use fewer slots if possible
6. **Future Flexibility**: Leave popular slots open

### Slot Value Ranking
```
Most Valuable (save for multi-stat items):
- Neck (3 slots)
- Finger (2 slots)
- Ears (2 slots)

Least Valuable (use first for single-stat):
- Pin (4 slots)
- Ankle (1 slot)
- Belt (1 slot)
```

### Cost Optimization
```
For each stat goal:
1. Calculate $/boost ratio for all items
2. Sort by efficiency (lowest $/boost first)
3. Build combination that reaches target
4. Check if slots are available
5. Repeat until optimal set found
```

## Implementation Phases

### Phase 1: Total Target Goals (Future)
- Allow user to set "Target: 20 Strength" instead of "Min Boost: 10"
- Calculate gap between current and target
- Show "You need 12 more Strength to reach goal"

### Phase 2: Set Builder (Future)
- Generate combinations of items that reach target
- Sort by total cost
- Show top 3 combinations with trade-offs

### Phase 3: Base vs Bonus Intelligence (Future)
- Automatically prefer Base over Bonus
- Show cost difference: "Base costs 50k more but is better"
- Let user override if budget constrained

### Phase 4: Slot Optimization (Future)
- Rank slots by value/scarcity
- Recommend using cheap slots first
- Warn: "This uses your last neck slot"

### Phase 5: Multi-Goal Optimization (Future)
- User has goals: "20 Strength, 15 Discipline"
- Find items that provide BOTH stats
- Minimize total cost and slots used

## Example User Flow (Future)

### Current Flow (Manual)
```
1. User: Create goal "Strength" min 10
2. System: Shows 50 items with 10+ Strength
3. User: Manually picks items, checks slots, calculates total
4. User: Buys items one by one
```

### Future Flow (Automated)
```
1. User: "I want 20 total Strength"
2. System: "You have 8, need 12 more"
3. System: "Best option: 3 items for 250k silvers"
4. System: Shows exact items with slots
5. User: "Buy all" → Done
```

## Technical Requirements

### New Database Fields
```sql
-- Add to set_goals table
target_total INTEGER  -- Target total (e.g., 20)
current_total INTEGER -- Current total from inventory
prefer_base BOOLEAN   -- Prefer Base over Bonus (default true)
```

### New Recommendation Engine Functions
```typescript
calculateCurrentTotal(inventory, stat) -> number
calculateGapToTarget(current, target) -> number
findOptimalCombination(items, gap, slots, budget) -> Recommendation[]
rankByEfficiency(items) -> sorted by $/boost
buildCompleteSets(goals, inventory, items) -> SetRecommendation[]
```

### New UI Components
- "Target Total" input field (instead of just min_boost)
- "Current Total" display (calculated from inventory)
- "Gap to Goal" indicator
- "Complete Set" recommendations (not just individual items)
- "Buy All" button for recommended sets

## Notes for Future Development

### Key Insight
**Users think in totals, not individual items.**
- "I need 20 Strength" = total across all items
- "I need +10 Discipline" = 10 more than I have now
- System should think the same way

### Complexity Considerations
- Combinatorial explosion: 1000s of items × multiple slots
- Need efficient algorithm (knapsack problem variant)
- Cache common combinations
- Limit to top 10 recommendations

### User Education
- Explain Base vs Bonus difference
- Show why certain slots are recommended
- Display trade-offs clearly
- Allow manual override of recommendations

## Related Files
- `src/recommendation-engine.ts` - Core logic to enhance
- `src/index.ts` - UI for goal creation
- `ENHANCEMENT_YAML_IMPORT.md` - Related enhancement docs

## Status
- **Current**: Goals are min_boost filters only
- **Future**: Goals become optimization targets
- **Priority**: High (core value proposition)
- **Complexity**: High (requires new algorithms)
