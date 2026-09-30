# AI Instructions — GS4 Enhancive Shopper

Primary reference for any AI assistant working on this project.

---

## Project Overview

Cloudflare Workers app (Hono + D1 + R2) that monitors GemStone IV player shop listings for enhancive items. Users manage characters, inventory, and goals. The system provides intelligent swap-group-aware recommendations and alerts via Discord DM.

- **Live URL**: https://gs4-enhancive-shopper.rpgfilms.workers.dev
- **Repo**: https://github.com/Buckwheet/GS4-EnhanciveShopper
- **Owner Discord ID**: `411322973920821258`

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Runtime | Cloudflare Workers (V8 isolates) |
| Framework | Hono |
| Database | Cloudflare D1 (SQLite) — `enhancive-db` |
| Object Storage | Cloudflare R2 — `enhancive-items` bucket |
| AI | Cloudflare Workers AI (@cf/meta/llama-3.1-8b-instruct) |
| Notifications | Discord Bot API (DMs) |
| Auth | Discord OAuth2 |
| Linting | Biome (v2.4.6) |
| Types | TypeScript (strict) |
| CSS | Tailwind (dev CDN — production build TODO) |
| Cron | `0 * * * *` (hourly scrape) |
| Data source | `https://shops.elanthia.online/data/{town}.json` (9 towns) |

---

## Development Workflow

Repo lives at `F:\Projects\Gemstone\enhancive-alert` (Windows). Remote: `https://github.com/Buckwheet/GS4-EnhanciveShopper`.

1. Branch off `main` (`feat/…`, `fix/…`, `chore/…`, `docs/…`), one small change per branch.
2. Open a PR referencing its issue (`Closes #N`). CI runs `tsc --noEmit` + `biome lint` on every PR.
3. Squash/merge to `main` → CI deploys to Cloudflare Workers. Manual redeploy: Actions → CI → Run workflow.

Never commit directly to `main`, never `--no-verify`.

### D1 Commands

```bash
npx wrangler d1 execute enhancive-db --remote --command="SQL"
```

### Local Dev

```bash
npm install
npm run dev        # Start local server
npm run lint       # Biome linter
npm run typecheck  # tsc --noEmit
```

---

## File Structure

```
src/
├── index.ts            (~4800+ lines) — All routes, HTML/CSS/JS frontend, scheduled jobs
├── enrichment.ts       — Swap groups, ability normalization, true cost calc, slot classification, stat Bonus 2x
├── recommender.ts      — assignLines() + 3-pass greedy algorithm with final recomputation
├── scraper.ts          — Fetches from shops.elanthia.online, captures item_type + is_bloodstone
├── matcher.ts          — Matches items against user goals, triggers Discord DMs
├── parser.ts           — Parses enhancive item descriptions
├── discord.ts          — Discord DM sending
├── constants.ts        — SLOT_LIMITS, STAT_CAP (40), SKILL_CAP (50)
├── types.ts            — EnhanciveItem includes item_type, is_bloodstone
├── pricer.ts           — Pricing utilities
├── recommendation-engine.ts — Legacy recommendation logic (superseded by recommender.ts)
├── migrate-hierarchy.ts    — DB migration utility
└── migrate-to-new-schema.ts — Schema migration utility
```

### Config Files

```
wrangler.toml       — Workers config, D1 binding, R2 binding, cron trigger, Discord client ID
biome.json          — Linting (noExplicitAny disabled)
tsconfig.json       — TypeScript strict mode
package.json        — Hono dep, Biome/Husky/TS/Wrangler devDeps
.husky/pre-commit   — Runs tsc + biome on commit
.github/workflows/ci.yml — Auto-deploy on push to main
.github/dependabot.yml   — Weekly security updates
```

---

## CRITICAL: Template Literal Escaping

The entire frontend (HTML/CSS/JS) lives inside a Hono template literal in `src/index.ts`. Standard escape sequences get consumed:

| What you write | Result |
|---------------|--------|
| `\d` | BROKEN — matches literal "d" |
| `\\\\d` | WORKS |
| `[0-9]` | WORKS (preferred) |

**Rule**: Use character classes (`[0-9]`, `[ ]`) instead of escape sequences, OR quadruple-escape.

---

## Database Schema

```sql
users (id, discord_id TEXT UNIQUE, username, avatar, access_token, refresh_token,
       notifications_enabled INTEGER DEFAULT 0, created_at)

characters (id, discord_id, name, show_useful_sum INTEGER DEFAULT 0,
            default_sort_total INTEGER DEFAULT 0, created_at)

sets (id, character_id, set_name, account_type DEFAULT 'F2P',
     base_stats TEXT, skill_ranks TEXT, created_at)

set_inventory (id, character_set_id, set_id, item_name, slot, enhancives_json,
               is_permanent INTEGER DEFAULT 0, is_locked INTEGER DEFAULT 0,
               is_irreplaceable INTEGER DEFAULT 0, is_bloodstone INTEGER DEFAULT 0, created_at)

set_goals (id, character_set_id, set_id, stat, min_boost, max_cost,
           preferred_slots, include_nugget_price INTEGER DEFAULT 0, created_at)

character_useless_skills (id, character_id, skill_name, UNIQUE(character_id, skill_name))

shop_items (id, name, town, shop, cost, enchant, worn, enhancives_json,
            is_permanent, is_bloodstone INTEGER DEFAULT 0, last_seen,
            available INTEGER DEFAULT 1, unavailable_since, scraped_at)

recommendation_cache (id, character_set_id, recommendations_json, created_at)
```

### Key Relationships
- `users.discord_id` → `characters.discord_id`
- `characters.id` → `sets.character_id`
- `sets.id` → `set_inventory.set_id`, `set_goals.set_id`
- Account type lives on the **set**, not the character

---

## Architecture: Hybrid D1 + R2

D1 handles low-write relational data (users, characters, goals, inventory, alerts). R2 handles high-write bulk data:

- **`items_enriched.json`** — All ~5,700 shop items pre-computed with swap group totals, true costs, swap costs. Written once per scrape.
- **`recommendations/{set_id}.json`** — Per-set shopping list. Written per recommendation run.

This keeps D1 writes well within the 100K/day free tier.

---

## Recommendation Engine (`src/recommender.ts`)

### `assignLines(abilities, gapMap, goals)`
Core function. For each swap group with active goals:
1. Collect item's enhancive lines in that group
2. Sort lines largest-first
3. Assign each line to the goal with the largest remaining gap (atomic — no splitting)
4. Track swap count (line assigned to different ability than its native)

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
  - Per-pick contributions, swap_cost, true_cost recalculated sequentially
```

### Cost Model
- **Base**: item price from shop
- **Nugget**: +25M (transmute weapon/armor/shield to jewelry)
- **Swatch**: +25M (change worn location when native slot full)
- **Pell**: +10M (make permanent, for non-permanent wearables)
- **Sylinara swap**: +10M per line swapped within group
- **Nugget transmute slot order**: ankle, waist, arms, hair, head, pin, single_ear, both_ears, wrist, fingers, neck

### Alpha (Cost Sensitivity)
| Alpha | Label | Behavior |
|-------|-------|----------|
| 1.0 | Aggressive | Picks best items, willing to spend |
| 1.5 | Balanced (default) | Looks for deals but doesn't obsess |
| 2.0 | Budget | Finds multi-goal wearables first |

---

## Swap Groups

| Group | Members |
|-------|---------|
| Stat A | Strength, Wisdom, Aura |
| Stat B | Constitution, Dexterity, Agility, Discipline |
| Stat C | Logic, Intuition, Influence |
| Weapons | Edged, Blunt, Ranged, Thrown, Polearm, Two-Handed, Brawling, Spell Aiming |
| MC | Elemental MC, Spirit MC, Mental MC |
| Lores | All 13 lores |
| Recovery | Mana Recovery, Stamina Recovery, Health Recovery (health at 1/2 value) |
| MIU/AS | Magic Item Use, Arcane Symbols |

Standalone abilities (no swap group): Max Health/Mana/Stamina/Spirit, Spirit Recovery, Dodging, Physical Fitness, Climbing, Swimming, First Aid, Stalking and Hiding, Perception, Picking Locks, Disarming Traps, Pickpocketing, Harness Power, Armor Use, Shield Use, Survival, Trading, Combat Maneuvers, MOC, TWC, Ambush.

### Stat Bonus Mechanics
- Stat items: `Discipline Bonus +6` counts as +12 toward the 40 cap (2x for stats only)
- Skill Bonus/Ranks: NOT doubled, treated at face value
- Both enrichment and inventory parsing apply the 2x for stat Bonus items

---

## Frontend Architecture

Single-page app rendered inside `src/index.ts` template literal.

### Key State Variables
```javascript
let allItems = [], filteredItems = [], currentUselessSkills = []
let showUsefulSum = false, defaultSortTotal = false
let renderedCount = 0
const BATCH_SIZE = 100  // virtualized table rows per batch
```

### Table Virtualization
Infinite scroll — renders 100 rows at a time via `#tableScroller` (70vh). Header is sticky.

### Sort Priority
1. If `defaultSortTotal` → sort by Total/Useful Sum descending
2. Else if goals active → sort by Match Sum descending
3. Else → DB order

### Dark Mode
Toggle in header, persisted in `localStorage` key `darkMode`. Tailwind `darkMode: 'class'`.

---

## API Routes

### Public
- `GET /` — Main SPA
- `GET /api/items` — All shop items
- `GET /api/ability-names` — Known ability/stat names

### Auth
- `GET /api/auth/discord` — Start OAuth
- `GET /api/auth/discord/callback` — OAuth callback
- `GET /api/auth/me` — Current user

### Character/Set Management (authenticated)
- CRUD: `/api/characters`, `/api/sets`, `/api/set-goals`, `/api/inventory`
- `POST /api/import-yaml` — YAML inventory import

### Analysis
- `GET /api/summary?set_id=N` — Enhancive summary with item breakdowns
- `GET /api/recommendations?set_id=N` — Recommendations
- `GET /api/recommend/:setId?alpha=1.5` — Greedy recommendation engine
- `GET /api/slot-usage?set_id=N` — Slot usage per account type

### Notifications
- `GET /api/test-dm` — Test Discord DM
- `POST /api/notifications` — Toggle notifications

### Debug
- `GET /api/debug/enriched` — Enriched items from R2 (add `?refresh=1` to force re-enrichment)
- `GET /api/scrape-health` — Scrape monitoring stats

---

## Coding Guidelines

- **Minimal code**: Write the ABSOLUTE MINIMAL code needed
- **Small incremental PRs**: one small change per PR, don't batch features
- **Exclude Yakushi shop** from recommendations
- **Bloodstone rule**: Only one bloodstone item active at a time; `is_bloodstone` flag on both tables
- **`min_boost=0`** in DB means "use the cap" (40 for stats, 50 for skills)

### DB Query Pattern
```typescript
const result = await c.env.DB.prepare('SELECT * FROM table WHERE id = ?').bind(id).first()
await c.env.DB.prepare('INSERT INTO table (col) VALUES (?)').bind(value).run()
```

### Type Assertions
```typescript
const data = await response.json() as { field?: type }
catch (error) { return c.json({ error: (error as Error).message }, 500) }
```

---

## Slot Limits by Account Type

### F2P
Pin: 8, Head: 1, Hair: 1, Single Ear: 1, Both Ears: 1, Neck: 3, Shoulder (slung): 2, Shoulders (draped): 1, Chest: 1, Front: 1, Back: 1, Arms: 1, Wrist: 2, Hands: 1, Fingers: 2, Waist: 1, Belt: 3, Legs: 1, Ankle: 1, Feet: 1

### Premium
Same except: Single Ear: 2, Both Ears: 2, Neck: 4, Wrist: 3, Fingers: 3

### Platinum
Same except: Single Ear: 3, Both Ears: 3, Neck: 5, Wrist: 4, Fingers: 4

---

## Implemented Features

- Discord OAuth login, multi-character, multi-set management
- Equipment sets with account type (F2P/Premium/Platinum)
- Inventory management with YAML import (Lich `enh_export.lic` script)
- Locked items, slot blockers, irreplaceable flag, bloodstone flag
- Alert goals with stat/skill matching, preferred slots, nugget pricing
- Useless skills per character (purple rendering, useful sum)
- Enhancive summary with item breakdown tooltips
- Slot usage visualization with color coding
- Swap-group-aware recommendation engine (3-pass greedy + assignLines)
- Per-pick cost breakdown (nugget, swatch, pell, swap costs)
- R2 enriched item cache with pre-computed swap group totals and true costs
- Discord DM alerts on matching items
- Scrape health monitoring with Discord alerts
- Dark mode, table virtualization (infinite scroll)
- Hourly cron scraping of 9 towns
- AI chat assistant (Cloudflare Workers AI)

---

## Known Issues

Tracked in GitHub Issues: https://github.com/Buckwheet/GS4-EnhanciveShopper/issues

---

## Debugging

```bash
wrangler tail                    # Live production logs
wrangler d1 execute enhancive-db --remote --command="SELECT ..."
curl https://gs4-enhancive-shopper.rpgfilms.workers.dev/api/items
```

---

## Test Results (as of 2026-03-18)
- **Mejora** (set=4, 8 goals, alpha=1.5): 12 items, 977.2M, 100% fill
- **Shollindal** (set=14, 4 goals, alpha=1.5): 2 items, 77.5M, 100% fill

---

*Last updated: 2026-03-26*
