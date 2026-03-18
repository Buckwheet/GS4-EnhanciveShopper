# CHECKPOINT — 2026-03-18 Session 3

## OBJECTIVE
Build a swap-group-aware intelligent recommendation engine for the GS4 Enhancive Shopper (Cloudflare Workers + Hono + D1 + R2). The system recommends optimal enhancive item purchases for GemStone IV characters based on their goals, current inventory, and budget preference.

## USER GUIDANCE
- **Minimal Code**: Write ABSOLUTE MINIMAL amount of code needed
- **Deploy sequence**: `cd /home/rpgfilms/enhancive-alert && git add -A && git commit --no-verify -m "message" && git push && cp -r src /mnt/c/Users/rpgfi/enhancive-alert/ && cd /mnt/c/Users/rpgfi && cmd.exe /c deploy-enhancive.bat 2>&1 | tail -5`
- **Template literal escaping**: All frontend JS is inside a Hono template literal in `src/index.ts`. Use `[0-9]` not `\d`, literal spaces not `\s`, or quadruple-escape `\\\\d`.
- **User's Discord ID**: `411322973920821258` (character Mejora id=8, Hunting set id=4)
- **Second test user Discord ID**: `785385281461026827` (character Tester McTest id=12)
- User prefers small incremental deploys and testing after each change
- No Node.js in WSL — only Windows Node via PATH. npm install fails on UNC paths.
- User is deeply knowledgeable about GemStone IV mechanics and actively corrects engine logic errors
- Exclude Yakushi shop from recommendations
- Account type lives on the **set**, not the character. Never read account_type from characters table.
- Wrangler D1 commands must run from `/mnt/c/Users/rpgfi/enhancive-alert`, DB name is `enhancive-db`
- For goals: target = cap (40 for stats, 50 for skills) when min_boost is 0/null

## COMPLETED

### Architecture (from prior sessions)
- **Hybrid D1 + R2**: D1 for user data, R2 for enriched items + recommendation results
- **R2 bucket `enhancive-items`** bound as `ITEMS_BUCKET`
- **`ARCHITECTURE_DECISION.md`** committed with full write budget analysis

### Enrichment Module (`src/enrichment.ts`)
- Pre-computes per item: swap group totals, true costs, swap costs per target ability, normalized abilities
- 5,689 items, 3.66 MB enriched blob in R2
- Exports: `SWAP_GROUPS`, `ABILITY_TO_GROUP`, `normalizeAbility`, `enrichItems`, `EnrichedItem`
- Scraper writes to both D1 AND R2 on every update cycle

### Recommendation Engine (`src/recommender.ts`) — 3-PASS ALGORITHM
- **Pass 1 — Greedy fill**: Pick best value items (score/log10(cost)^alpha) until all goals met
- **Pass 2 — Prune**: Remove redundant picks (worst value first) where remaining picks still meet all goals
- **Pass 3 — Downgrade**: Replace expensive picks with cheaper alternatives that still meet all goals
- **Per-slot availability**: Tracks open slots per slot type from `sets.account_type` + `SLOT_LIMITS` - inventory
- **Swatch cost (25M)**: Added when item's native slot is full and needs location change
- **Nugget transmute slots**: pin, head, hair, ear, ears, neck, arms, wrist, finger, waist, ankle. If none open, adds swatch cost.
- **Goal checking uses group_totals with proportional split** for shared groups (e.g. Lores split between Religion + Blessings)
- **Alpha stored per set** in DB (`sets.alpha` column, default 1.5)
- Exports: `runRecommendation`, `resolveGoals`, `resolveGoalStat`

### Mejora Test Results (set_id=4, 8 goals, alpha=1.5)
- 12 items, 483M total, 100% fill
- Overfunding minimal: +1 MC, +3 Recovery, +0.5 each Lore
- Goals: Wisdom(capped), Discipline(capped), Logic(capped), Spirit MC, Spell Aiming, Mana Recovery, Religion, Blessings

### UI Changes This Session
1. **Simplified Total Sum column** — plain sum of boost values minus useless skills, no advanced calc
2. **Hidden advanced skill calc checkbox** — still functional but hidden
3. **Goal dropdown** — exact ability names from static list (Stats, MCs, Lores, Weapons, Recovery, Other) instead of free text
4. **Null min_boost** — leave blank for cap (40/50), stored as 0 in DB, displayed as cap value
5. **Collapsible goals section** — click header to collapse, shows character/set name + goal summary when collapsed
6. **Advanced Search** — slot filter checkboxes + enhancive text search (e.g. "lore 10") under main search bar
7. **Hidden preferred slots** from goal form (moved to Advanced Search)
8. **Budget Strategy dropdown** on set create/edit modal — Cash Flush (1.0), Balanced (1.5), Budget (2.0)
9. **My Matches modal** — wired to recommendation engine, shows all picks on Available tab with summary

### Bug Fixes
- **Skill rank regex** — `/s+ranks$/i` → `/ Ranks$/i` (template literal ate the backslash)
- **Post-prune gap recalc** — uses group_totals with proportional split instead of stale contributions

### DB Changes
- `sets.alpha REAL DEFAULT 1.5` — migration via `/api/migrate-alpha`
- `set_goals.stat` now stores exact ability names (e.g. "Spirit Mana Control" not "mana control")
- All old fuzzy goals deleted, re-entered as exact names

## KEY FILES
- `src/index.ts` (~4600+ lines) — All routes, HTML/CSS/JS frontend, scraper
- `src/enrichment.ts` — Swap groups, ability normalization, true cost calculation
- `src/recommender.ts` — 3-pass greedy algorithm with prune + downgrade
- `src/types.ts` — `Env` interface (includes `ITEMS_BUCKET: R2Bucket`)
- `src/constants.ts` — `SLOT_LIMITS`, `STAT_CAP` (40), `SKILL_CAP` (50)

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

## COST MODEL
- **Base cost**: item price from shop
- **Nugget**: +25M (transmute armament to jewelry)
- **Swatch**: +25M (change worn location)
- **Pell**: +10M (make permanent, for wearables)
- **Sylinara swap**: +10M per ability swap within group
- **Nugget transmute targets**: pin, head, hair, ear, ears, neck, arms, wrist, finger, waist, ankle
- **Swatch targets**: all 24 worn locations — any item can reach any slot via transmute+swatch chain

## ALGORITHM FORMULA
```
score = sum(min(contribution[g], gap[g]) / gap[g] for each goal g with gap > 0)
true_cost = base + nugget_cost + swatch_cost + swap_cost
value = score / log10(max(true_cost, 1000))^alpha
```

## MY MATCHES TABS (current state)
1. **Available** — All recommendation picks with summary (items, cost, fill %)
2. **Sold** — Empty/coming soon
3. **Direct** — Coming soon
4. **Nuggets** — Coming soon
5. **Swatches** — Coming soon
6. **Swaps** — Coming soon

## NEXT STEPS
1. **Populate remaining My Matches tabs** — split picks into Direct (native slot open), Nuggets (is_nugget), Swatches (needs swatch) categories
2. **Bloodstone family exclusion** — user already owns one bloodstone item, only one can be active
3. **Inventory replacement evaluation** — should engine suggest replacing non-locked items?
4. **Fix broken debug routes** — `debug/alerts` handler is unclosed, swallowing subsequent routes
5. **Sold tab** — show recently sold items that matched goals
6. **Swaps tab** — suggest replacing existing inventory items with better shop items

## KNOWN ISSUES
- `debug/alerts` route (~line 3910) missing closing `})`, swallowing debug routes after it
- `resolveGoalStat` still does fuzzy matching but goals are now exact names (harmless, works correctly)
- Old `/api/my-matches` and `/api/recommendations` endpoints still exist but no longer called from UI
