# CHECKPOINT — 2026-03-18 Session 5

## OBJECTIVE
Build a swap-group-aware intelligent recommendation engine for the GS4 Enhancive Shopper (Cloudflare Workers + Hono + D1 + R2). Recommends optimal enhancive item purchases based on goals, inventory, and budget.

## USER GUIDANCE
- **Minimal Code**: Write ABSOLUTE MINIMAL amount of code needed
- **Deploy sequence**: `cd /home/rpgfilms/enhancive-alert && git add -A && git commit --no-verify -m "message" && git push && cp -r src /mnt/c/Users/rpgfi/enhancive-alert/ && cd /mnt/c/Users/rpgfi && cmd.exe /c deploy-enhancive.bat 2>&1 | tail -5`
- **Template literal escaping**: All frontend JS is inside a Hono template literal in `src/index.ts`. Use `[0-9]` not `\d`, literal spaces not `\s`, or quadruple-escape `\\\\d`.
- **User's Discord ID**: `411322973920821258` (character Mejora id=8/set=4, character Shollindal id=13/set=14)
- User prefers small incremental deploys and testing after each change
- No Node.js in WSL — only Windows Node via PATH
- User is deeply knowledgeable about GemStone IV mechanics
- Exclude Yakushi shop from recommendations
- Account type lives on the **set**, not the character
- Wrangler D1 commands: `cd /mnt/c/Users/rpgfi/enhancive-alert && npx wrangler d1 execute enhancive-db --remote --command="SQL"`
- `min_boost=0` in DB means "use the cap" (40 for stats, 50 for skills)
- Force re-enrichment: `curl -s '.../api/debug/enriched?refresh=1'`

## COMPLETED THIS SESSION

### Per-Line Assignment Model (Major Algorithm Fix)
- **Problem**: Engine treated swap groups as fungible pools — e.g. an item with +12 Intuition could "split" into +5 Logic and +6 Intuition. In reality, each enhancive line is atomic: the +12 Intuition either stays as Intuition or swaps entirely to Logic/Influence.
- **Fix**: New `assignLines()` function replaces all pooling logic. For each item, assigns each enhancive line to the best goal (swap or keep), respecting atomic swaps. Lines sorted largest-first, assigned to largest remaining gap.
- **Replaced in**: greedy contribution calc, `allGoalsMet()` check, final gap recalculation, per-pick contribution display, swap cost calculation.
- **Result**: Shollindal 81.2M → 77.5M (found better combo). Mejora 483M → 667M → 747M → 977M (honest accounting — no more over-counting shared group contributions).

### Stat Bonus 2x Conversion
- **Problem**: `Discipline Bonus +6` counts as +12 toward the stat enhancive cap (40), but engine treated it as +6. Mejora showed a 4-point Discipline gap that didn't exist (inventory had 42 effective, not 36).
- **Fix**: Both inventory parsing (recommender) and shop item enrichment detect `Bonus` suffix on stat abilities (groups starting with "Stat") and double the boost value.
- **Note**: Skill Bonus/Ranks are different — skills don't get doubled. Only stat Bonus items (Stat A/B/C groups).

### Bloodstone Item Exclusion
- **Detection**: Scraper checks `details.raw` for `"infused with the vitality of an Empath"` — only reliable marker (name/appearance can be altered).
- **DB**: `is_bloodstone INTEGER DEFAULT 0` on both `shop_items` and `set_inventory`.
- **UI**: 🩸 Bloodstone checkbox on every inventory item (manual, user-controlled).
- **Engine**: When any inventory item in the set has `is_bloodstone=1`, all bloodstone shop items are excluded from candidates.
- **Rule**: Only one bloodstone item can be active at a time in GemStone IV.
- 2 bloodstone items found in current shop data (both oval bloodstone pendants).

### Cost Breakdown Display
- **Problem**: User saw "Swap: 30M" but couldn't tell a 25M swatch was also hidden in the price. Total cost was opaque.
- **Fix**: API now returns per-pick: `nugget_cost`, `swatch_cost`, `pell_cost`, `swap_cost`. Frontend shows each as a separate line (orange text).
- **Fills line** now includes total cost: "Fills: Spell Aiming +10 · 57.0M total"

### Final Pass True Cost Recomputation
- **Problem**: `true_cost` and `contributions` on picks were stale from greedy/downgrade passes. Downgrade copied old item's contributions. Swap costs didn't match final line assignments.
- **Fix**: After prune/downgrade, final pass recalculates per-pick: contributions via `assignLines`, swap count, and true_cost (base + nugget + pell + swatch + swap) with correct slot availability tracking.

### NUGGET_SLOTS Reorder
- Reordered to prefer less-contested slots: `ankle, waist, arms, hair, head, pin, single_ear, both_ears, wrist, fingers, neck`
- Prevents nugget transmutes from stealing slots needed by cheap wearable alternatives.

## KEY FILES
- `src/index.ts` (~4800+ lines) — All routes, HTML/CSS/JS frontend, scraper
- `src/enrichment.ts` — Swap groups, ability normalization, true cost calc, `classifySlot()`, stat Bonus 2x
- `src/recommender.ts` — `assignLines()` + 3-pass algorithm with final recomputation
- `src/scraper.ts` — Pulls from shops.elanthia.online, captures `item_type` + `is_bloodstone`
- `src/types.ts` — `EnhanciveItem` includes `item_type`, `is_bloodstone`
- `src/constants.ts` — `SLOT_LIMITS`, `STAT_CAP` (40), `SKILL_CAP` (50)

## RECOMMENDATION ENGINE (`src/recommender.ts`)

### `assignLines(abilities, gapMap, goals)`
Core function. For each swap group with active goals:
1. Collect item's enhancive lines in that group
2. Sort lines largest-first
3. Assign each line to the goal with the largest remaining gap
4. Track swap count (line assigned to different ability than its native)
Returns `{ contributions, swapCount }`

### 3-Pass Algorithm
```
Pass 1 (Greedy): Pick best value items until all goals met
  - value = weightedScore / log10(max(trueCost, 1000))^alpha
  - Uses assignLines for per-item contribution calc
  - Nugget transmute prefers less-contested slots

Pass 2 (Prune): Remove redundant picks (worst value first)
  - allGoalsMet() uses assignLines across ALL picks' lines

Pass 3 (Downgrade): Replace expensive picks with cheaper alternatives
  - calcTrueCost() includes swatch (slot-aware) + swap via assignLines

Final: Recompute all picks
  - Per-pick contributions via assignLines (sequential, consuming gaps)
  - Per-pick swap_cost from actual swap count
  - Per-pick true_cost from base + nugget + pell + swatch + swap
```

## COST MODEL
- **Base**: item price from shop
- **Nugget**: +25M (transmute weapon/armor/shield to jewelry)
- **Swatch**: +25M (change worn location when native slot full)
- **Pell**: +10M (make permanent, for non-permanent wearables)
- **Sylinara swap**: +10M per line swapped within group
- **Nugget transmute targets** (ordered): ankle, waist, arms, hair, head, pin, ear, ears, wrist, fingers, neck

## SWAP GROUPS
```
Stat A: {Strength, Wisdom, Aura}
Stat B: {Constitution, Dexterity, Agility, Discipline}
Stat C: {Logic, Intuition, Influence}
Weapons: {Edged, Blunt, Ranged, Thrown, Polearm, Two-Handed, Brawling, Spell Aiming}
MC: {Elemental MC, Spirit MC, Mental MC}
Lores: {All 13 lores}
Recovery: {Mana Recovery, Stamina Recovery, Health Recovery}
MIU/AS: {Magic Item Use, Arcane Symbols}
```

## STAT BONUS MECHANICS
- Stat items come as Base or Bonus. `Discipline (DIS)` = Base, `Discipline Bonus` = Bonus.
- For stats: Bonus value × 2 = effective stat contribution toward the 40 cap.
- For skills: Bonus and Ranks are separate systems (not doubled). Engine currently treats skill Bonus at face value.
- Enrichment and inventory parsing both apply the 2x for stat Bonus items.

## TEST RESULTS
- **Mejora** (set=4, 8 goals, alpha=1.5): 12 items, 977.2M, 100% fill
- **Shollindal** (set=14, 4 goals, alpha=1.5): 2 items, 77.5M, 100% fill

## DB CHANGES THIS SESSION
```sql
ALTER TABLE shop_items ADD COLUMN is_bloodstone INTEGER DEFAULT 0
ALTER TABLE set_inventory ADD COLUMN is_bloodstone INTEGER DEFAULT 0
```

## NEXT STEPS
1. **Remove debugLog from production** — clean up debug output from API response
2. **Skill Bonus/Ranks handling** — currently at face value; may need conversion table
3. **Populate remaining My Matches tabs** — Direct, Nuggets, Swatches, Swaps
4. **Inventory replacement evaluation** — suggest replacing non-locked items
5. **Overflow swap suggestions** — "you have +12 Logic but only need +5, consider swapping to Influence"
6. **Fix broken debug routes** — `debug/alerts` handler missing closing `})`

## KNOWN ISSUES
- `debugLog` still in API response (remove after debugging complete)
- `debug/alerts` route (~line 3910) missing closing `})`, swallowing routes after it
- Old `/api/my-matches` and `/api/recommendations` endpoints still exist but unused
- Greedy pass slot costing may still pick suboptimal items that final recompute reveals as expensive (swatch costs appear in final pass that weren't in greedy)
- Total cost jumped significantly (747M → 977M) when final pass correctly added swatch costs — greedy may need slot-aware costing improvement
