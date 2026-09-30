# Session Progress — 2026-03-16 (Part 2)

## Completed

### 1. Table Virtualization
- Replaced `renderItems()` with infinite scroll — 100 rows per batch via `BATCH_SIZE`
- Added `#tableScroller` container (70vh max-height, overflow-auto)
- Sticky table header (`sticky top-0 z-10`)
- Split table into two: header table + scrollable body table
- Scroll listener loads next batch when within 200px of bottom
- `renderedCount` tracks rows rendered, `buildRow(item)` extracted as helper
- Removed old 500-item hard cap and "Showing first 500" message
- All 5,700+ items now accessible by scrolling

### 2. AI_INSTRUCTIONS.md
- Comprehensive cross-IDE reference document
- Covers: tech stack, deploy sequence, file structure, template literal escaping, DB schema, frontend architecture, API routes, coding guidelines, features, TODO
- Committed and pushed for use in other IDEs

### 3. Swap Group Engine Design (SWAP_GROUP_ENGINE.md)
- Documented all swap groups from gswiki.play.net/Enhancive_services
- Defined new goal model: target-based (ability + cap) vs current threshold-based (free-text + min_boost)
- Group-aware item scoring: sum all enhancives in swap group per item
- Gap calculation: target - current inventory total (using swap group sums)
- Alert thresholds based on gap fill percentage, not user-defined min_boost
- 5 implementation phases defined

### 4. DecisionBrain.md — Core Engine Logic
Deep analysis session using Mejora's real data (set_id=4, Hunting set) revealed critical engine requirements:

**Key discoveries:**
- Swap groups make enhancives fungible — an item with Fire Lore 5 + Air Lore 2 + Blessings 7 + Summoning 1 = +15 toward ANY lore goal
- Users set broad goals ("lore +15") because they're manually approximating swap group awareness + rarity thresholds — the engine should do this automatically
- Current matcher checks individual enhancive boosts, misses multi-enhancive items that sum to threshold within a swap group

**The Replacement Cascade Problem:**
- Replacing an item must be evaluated across ALL goals, not just the target goal
- Real example: replacing Mejora's starstone crown (+6 Wisdom) with a greathelm (+10 SMC, +6 Spell Aiming) gains +16 toward MC/WA goals but drops Wisdom from 45→39, breaking the 40 target
- Every recommendation must be a system-wide transaction

**Slot constraints:**
- Open slots: equip directly, no extra cost
- Replaceable slots: can upgrade if new item is better, but must check cascade
- Locked slots: armor, functional gear — cannot be touched, must nugget/swatch elsewhere
- Nugget (25M) and swatch (25M) costs must be factored into total cost

**Algorithm:** Multi-Dimensional Knapsack Problem variant. Greedy heuristic with constraint checking for single items, bounded combinatorial search for 2-3 item combos.

### 5. Mejora's Current State (analyzed)
Goals and gaps (swap-group-aware):
- Wisdom (Stat A): 45/40 — **over cap** ✓
- Discipline (Stat B): 40/40 — **capped** ✓
- Logic (Stat C): 40/40 — **capped** ✓
- Spirit Mana Control (MC group): 16/50 — **need 34**
- Spell Aiming (Weapons group): 25/50 — **need 25**

12 open slots available, multiple replaceable slots, 5 fully locked slots (chest/feet/hands/shoulders/waist).

## Files Created/Modified
- `src/index.ts` — Table virtualization (renderItems rewrite)
- `AI_INSTRUCTIONS.md` — New file, cross-IDE reference
- `SWAP_GROUP_ENGINE.md` — New file, swap group engine design
- `DecisionBrain.md` — New file, core engine logic and rules

## In Progress
- **Tailwind CSS production build** — Standalone CLI binary download started but timed out from WSL. User given PowerShell command to download `tailwindcss-windows-x64.exe` manually. Build pipeline not yet configured.

## Next Steps
1. Finish Tailwind production build (once binary is downloaded)
2. Begin engine implementation Phase 1: swap group constants and resolution functions in `src/constants.ts`
3. Phase 2: inventory gap calculator
4. Phase 3: item scoring with group sums
5. Phase 4: slot-aware filtering
6. Phase 5: replacement impact analysis
