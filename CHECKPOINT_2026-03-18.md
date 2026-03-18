# CHECKPOINT — 2026-03-18 Session 4

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

### item_type Classification (Major Fix)
- **Problem**: Shields/weapons/armor worn on `shoulders` were misclassified as wearables. Engine treated them as swatch-only (25M) instead of nugget-required (25M nugget + 25M swatch).
- **Source data has `item_type`**: `weapon`, `shield`, `armor`, `jewelry`, `container` — available from shops.elanthia.online
- Added `item_type` column to `shop_items` table, captured in scraper, backfilled all 5,679 items
- Updated `classifySlot()` in enrichment to use `item_type` instead of guessing from `worn` field
- Both scraper code paths (POST `/api/scrape` and scheduled `runScrape`) now write `item_type` on insert AND update
- Removed stale `NUGGET_SLOTS` set from enrichment.ts (was incorrectly including shoulders, chest, etc.)

### Scraper Auto-Regenerates Recommendations
- After enrichment write, scraper queries all sets with goals where user `last_active` within 30 days
- Runs `runRecommendation()` for each, writes `recommendations/{setId}.json` to R2
- R2 write budget: 1,000 sets × 24/day × 30 = 720K/month, well under 1M free tier

### User Activity Tracking
- Added `last_active TEXT` column to `users` table, seeded existing 3 users
- Updated once per day max via `/api/character-sets` GET: `WHERE last_active IS NULL OR last_active < datetime('now', '-1 day')`
- `last_login` (existing) = Discord OAuth only; `last_active` (new) = site usage
- Scraper skips recommendation regen for users inactive >30 days

### Downgrade Pass Improvements
- **Slot-aware cost calculation**: `calcTrueCost()` now accounts for swatch costs based on actual slot availability and current pick set's slot usage
- **Swap cost included**: Downgrade alternatives now include Sylinara swap costs in their true cost comparison
- **NUGGET_SLOTS reordered**: `ankle, waist, arms, hair, head, pin, ear, ears, wrist, fingers, neck` — less-contested slots first so nugget transmutes don't steal slots needed by cheap wearables
- **Result**: Shollindal's set dropped from 106M → 81.2M (neckchain at 250K replaced 25M nuggetized whip-blade for +2 Discipline)

### Bug Fixes
- **Blank set selector**: When switching characters, `currentSetId` from previous character didn't exist in new character's sets → blank dropdown. Now checks if current set exists in new set list.
- **Skill item display**: Summary tooltip showed doubled `effectiveBoost` for Bonus skills instead of raw boost. Items now show actual contribution matching the total.
- **Two scraper code paths**: `/api/scrape` POST had its own UPDATE statement missing `item_type` — fixed both paths.

### Debug Tooling
- `debugLog` array in recommendation result — logs downgrade candidates, costs, slot info
- `/api/debug/enriched?refresh=1` — force re-enrichment from D1 to R2

## KEY FILES
- `src/index.ts` (~4700+ lines) — All routes, HTML/CSS/JS frontend, scraper
- `src/enrichment.ts` — Swap groups, ability normalization, true cost calculation, `classifySlot()` uses `item_type`
- `src/recommender.ts` — 3-pass algorithm with slot-aware downgrade
- `src/scraper.ts` — Pulls from shops.elanthia.online, captures `item_type`
- `src/types.ts` — `EnhanciveItem` includes `item_type: string | null`
- `src/constants.ts` — `SLOT_LIMITS`, `STAT_CAP` (40), `SKILL_CAP` (50)

## D1 SCHEMA
```sql
users (id, discord_id, discord_username, email, password_hash, created_at, last_login, notifications_enabled, last_active)
characters (id, discord_id, character_name, account_type, base_stats, skill_ranks, show_useful_sum, default_sort_total)
sets (id, character_id, set_name, account_type, alpha REAL DEFAULT 1.5, created_at)
set_goals (id, set_id, stat TEXT, min_boost INTEGER NOT NULL, max_cost, preferred_slots, include_nugget_price)
set_inventory (id, set_id, item_name, slot, enhancives_json, is_permanent, is_irreplaceable, is_locked)
shop_items (id, name, town, shop, cost, enchant, worn, item_type, enhancives_json, scraped_at, last_seen, available, unavailable_since, is_permanent)
```

## RECOMMENDATION ENGINE (`src/recommender.ts`)
```
Pass 1 (Greedy): Pick best value items until all goals met
  - value = weightedScore / log10(max(trueCost, 1000))^alpha
  - Per-slot tracking with swatch/nugget costs
  - Nugget transmute prefers less-contested slots (ankle first, neck last)

Pass 2 (Prune): Remove redundant picks (worst value first)
  - allGoalsMet() checks group_totals with proportional gap-based split

Pass 3 (Downgrade): Replace expensive picks with cheaper alternatives
  - calcTrueCost() includes: base + pell + swatch (slot-aware) + swap costs
  - Tracks pickSlots to avoid double-counting slot usage
  - Frees excluded pick's slot when evaluating replacements
```

## COST MODEL
- **Nugget**: base + 25M (transmute to jewelry)
- **Swatch**: +25M (change worn location, needed when native slot full)
- **Pell**: +10M (make permanent, for non-permanent wearables)
- **Sylinara swap**: +10M per ability swap within group
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

## TEST RESULTS
- **Mejora** (set=4, 8 goals, alpha=1.5): 12 items, 483M, 100% fill
- **Shollindal** (set=14, 4 goals, alpha=1.5): 2 items, 81.2M, 100% fill
  - razern twohanded sword (nugget, 81M) fills Logic+5, Intuition+6, Discipline+13
  - opal neckchain (250K, neck slot) fills Discipline+2

## NEXT STEPS
1. **Remove debugLog from production** — clean up debug output from API response
2. **Populate remaining My Matches tabs** — Direct (wearables), Nuggets, Swatches, Swaps
3. **Bloodstone family exclusion** — only one bloodstone item can be active
4. **Inventory replacement evaluation** — suggest replacing non-locked items with better alternatives
5. **Greedy pass also needs slot-aware costing** — currently only downgrade has `calcTrueCost`, greedy uses simpler logic that may pick suboptimal items

## KNOWN ISSUES
- `debug/alerts` route (~line 3910) missing closing `})`, swallowing routes after it
- `debugLog` still in API response (remove after debugging complete)
- Greedy pass slot costing is simpler than downgrade's `calcTrueCost` — may pick expensive nuggets when cheap wearables exist
- Old `/api/my-matches` and `/api/recommendations` endpoints still exist but unused
