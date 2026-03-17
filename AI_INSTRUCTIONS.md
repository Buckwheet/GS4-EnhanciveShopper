# AI Instructions — GS4 Enhancive Shopper

Use this document as the primary reference when working on this project in any IDE or AI assistant.

---

## Project Overview

Cloudflare Workers app (Hono framework, D1 database) that monitors GemStone IV player shop listings for enhancive items. Users manage characters, inventory, and goals. The system provides intelligent item recommendations and alerts via Discord DM when matching items appear.

- **Live URL**: https://gs4-enhancive-shopper.rpgfilms.workers.dev
- **Repo**: https://github.com/Buckwheet/GS4-EnhanciveShopper
- **Owner Discord ID**: `411322973920821258`

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Runtime | Cloudflare Workers (V8 isolates) |
| Framework | Hono (lightweight web framework) |
| Database | Cloudflare D1 (SQLite) — `enhancive-db` |
| AI | Cloudflare Workers AI (@cf/meta/llama-3.1-8b-instruct) |
| Notifications | Discord Bot API (DMs) |
| Auth | Discord OAuth2 |
| Linting | Biome |
| Types | TypeScript (strict) |
| CSS | Tailwind (dev CDN — production build is a TODO) |
| Cron | `0 * * * *` (hourly scrape) |
| Data source | `https://shops.elanthia.online/data/{town}.json` (9 towns) |

---

## Development Environment (WSL/Windows Hybrid)

This project uses a split environment:

| Purpose | Path |
|---------|------|
| Development, Git, editing | `/home/rpgfilms/enhancive-alert/` (WSL Ubuntu) |
| Deployment via Wrangler | `/mnt/c/Users/rpgfi/enhancive-alert/` (Windows) |

### Deploy Sequence (CRITICAL)

Always use this exact sequence to deploy:

```bash
cd /home/rpgfilms/enhancive-alert && \
  git add -A && \
  git commit --no-verify -m "commit message" && \
  git push && \
  cp -r src /mnt/c/Users/rpgfi/enhancive-alert/ && \
  cd /mnt/c/Users/rpgfi && \
  cmd.exe /c deploy-enhancive.bat 2>&1 | tail -5
```

The `deploy-enhancive.bat` does a full xcopy from WSL then runs `npx wrangler deploy`. GitHub Actions CI also auto-deploys on push to main.

### Local Dev

```bash
cd /home/rpgfilms/enhancive-alert
npm run dev        # Start local server
npm run lint       # Biome linter
npm run typecheck  # tsc --noEmit
```

---

## File Structure

### Source Files

```
src/
├── index.ts                (~4564 lines) — ALL routes, ALL HTML/CSS/JS frontend, scheduled jobs
├── scraper.ts              (64 lines)    — Fetches items from shops.elanthia.online
├── matcher.ts              (80 lines)    — Matches items against user goals, triggers Discord DMs
├── parser.ts               (155 lines)   — Parses enhancive item descriptions
├── discord.ts              (50 lines)    — Discord DM sending
├── constants.ts            (27 lines)    — SLOT_LIMITS, STAT_CAP (40), SKILL_CAP (50)
├── types.ts                (26 lines)    — TypeScript type definitions
├── recommendation-engine.ts (329 lines)  — Item recommendation logic
├── migrate-hierarchy.ts    (95 lines)    — DB migration utility
└── migrate-to-new-schema.ts (99 lines)   — Schema migration utility
```

### Config Files

```
wrangler.toml       — Workers config, D1 binding, cron trigger, Discord client ID
biome.json          — Linting (noExplicitAny disabled)
tsconfig.json       — TypeScript strict mode
package.json        — Hono dep, Biome/Husky/TS/Wrangler devDeps
.husky/pre-commit   — Runs tsc + biome on commit
.github/workflows/ci.yml — Auto-deploy on push to main
```

---

## CRITICAL: Template Literal Escaping

**The entire frontend (HTML/CSS/JS) lives inside a Hono template literal in `src/index.ts`.**

This means all JavaScript regex patterns are inside backtick strings. Standard escape sequences get consumed by the template literal:

| What you write | What JS sees | Result |
|---------------|-------------|--------|
| `\d` | `d` | BROKEN — matches literal "d" |
| `\s` | `s` | BROKEN — matches literal "s" |
| `\\d` | `\d` | Still consumed by template |
| `\\\\d` | `\\d` → regex `\d` | WORKS |
| `[0-9]` | `[0-9]` | WORKS (preferred) |

**Rule**: Use character classes (`[0-9]`, `[ ]`) instead of escape sequences, OR quadruple-escape (`\\\\d`, `\\\\s`).

---

## Database Schema (Current Production)

### Core Tables

```sql
-- Users (Discord OAuth)
users (id, discord_id TEXT UNIQUE, username, avatar, access_token, refresh_token,
       notifications_enabled INTEGER DEFAULT 0, created_at)

-- Characters (per user)
characters (id, discord_id, name, show_useful_sum INTEGER DEFAULT 0,
            default_sort_total INTEGER DEFAULT 0, created_at)

-- Character Sets (equipment/goal groupings per character)
-- Note: "character_set_id" in child tables refers to sets.id
sets (id, character_id, set_name, account_type DEFAULT 'F2P',
     base_stats TEXT, skill_ranks TEXT, created_at)

-- Inventory items per set
set_inventory (id, character_set_id, set_id, item_name, slot, enhancives_json,
               is_permanent INTEGER DEFAULT 0, is_locked INTEGER DEFAULT 0,
               is_irreplaceable INTEGER DEFAULT 0, created_at)

-- Alert goals per set
set_goals (id, character_set_id, set_id, stat, min_boost, max_cost,
           preferred_slots, include_nugget_price INTEGER DEFAULT 0, created_at)

-- Useless skills per character (for filtering)
character_useless_skills (id, character_id, skill_name,
                          UNIQUE(character_id, skill_name))

-- Scraped shop items
shop_items (id, name, town, shop, cost, enchant, worn, enhancives_json,
            is_permanent, last_seen, available INTEGER DEFAULT 1,
            unavailable_since, scraped_at)

-- Recommendation cache
recommendation_cache (id, character_set_id, recommendations_json, created_at)
```

### Key Relationships
- `users.discord_id` → `characters.discord_id`
- `characters.id` → `sets.character_id`
- `sets.id` → `set_inventory.set_id`, `set_goals.set_id`
- `characters.id` → `character_useless_skills.character_id`

---

## Frontend Architecture

The entire UI is a single-page app rendered inside `src/index.ts` as a template literal returned by the `/` route. Key elements:

### Global JS State Variables

```javascript
let allItems = []                  // All items from API
let filteredItems = []             // After filtering, before/after sort
let currentUselessSkills = []      // Skill names marked useless
let showUsefulSum = false          // Show useful sum as primary display
let defaultSortTotal = false       // Default sort by total/useful sum
let modalOriginalState = null      // Snapshot for dirty check on modal close
let allAbilityNames = []           // Cached from /api/ability-names
let currentSortColumn = null       // Current sort column or null
let currentSortDirection = 'asc'   // 'asc' or 'desc'
let renderedCount = 0              // Virtualized table: rows rendered so far
const BATCH_SIZE = 100             // Virtualized table: rows per batch
```

### Sort Priority (in `filterItems()`)

1. If `defaultSortTotal` → sort by Total Sum (or Useful Sum) descending
2. Else if goals active → sort by Match Sum descending
3. Else → no sort (DB order)

### Table Virtualization

The items table uses infinite scroll — renders 100 rows at a time, loads more when scrolling near bottom. The scroll container is `#tableScroller` (70vh max-height). Header is sticky.

### Dark Mode

- Toggle button in header (moon/sun icon), visible to all users
- Tailwind `darkMode: 'class'` — adds/removes `dark` class on `<html>`
- CSS overrides with `.dark` prefix and `!important`
- Colors: bg `#1a1a2e`, cards `#16213e`, inputs `#0f3460`, borders `#2a2a4a`
- Persisted in `localStorage` key `darkMode` (`'1'`/`'0'`)

### Key DOM IDs

| ID | Purpose |
|----|---------|
| `itemsTable` | `<tbody>` for shop items |
| `tableScroller` | Scroll container for virtualized table |
| `totalItems` | Item count display |
| `summaryContent` | Collapsible enhancive summary body |
| `summaryChevron` | Chevron icon for summary toggle |
| `usefulSumNotice` | Notice when useful sum is active |
| `defaultSortTotalLabel` | Checkbox label for default sort |
| `goalFilterStatus` | "Filtering by N goals" text |
| `darkModeBtn` | Dark mode toggle button |

---

## API Routes

### Public
- `GET /` — Main SPA page
- `GET /api/items` — All shop items (JSON)
- `GET /api/ability-names` — All known ability/stat names

### Auth
- `GET /api/auth/discord` — Start Discord OAuth
- `GET /api/auth/discord/callback` — OAuth callback
- `GET /api/auth/me` — Current user info

### Character/Set Management (authenticated)
- `GET/POST/DELETE /api/characters`
- `GET/POST/DELETE /api/sets`
- `GET/POST/PUT/DELETE /api/set-goals`
- `GET/POST/DELETE /api/inventory`
- `POST /api/import-yaml` — YAML inventory import

### User Preferences
- `POST /api/useless-skills` — Set useless skills for character
- `POST /api/show-useful-sum` — Toggle useful sum display
- `POST /api/default-sort-total` — Toggle default sort preference

### Analysis
- `GET /api/summary?set_id=N` — Enhancive summary with item breakdowns
- `GET /api/recommendations?set_id=N` — AI-powered recommendations
- `GET /api/slot-usage?set_id=N` — Slot usage per account type

### Notifications
- `GET /api/test-dm` — Test Discord DM
- `POST /api/notifications` — Toggle notifications

### System
- `GET /api/scrape-health` — Scrape monitoring stats
- Cron trigger → `runScrape(env)` hourly

---

## Coding Guidelines

### Minimal Code
Write the ABSOLUTE MINIMAL code needed. No verbose implementations, no code that doesn't directly contribute to the solution.

### Small Incremental Deploys
Deploy and test after each change. Don't batch multiple features into one deploy.

### Database Queries Pattern
```typescript
const result = await c.env.DB.prepare('SELECT * FROM table WHERE id = ?')
  .bind(id).first()

await c.env.DB.prepare('INSERT INTO table (col) VALUES (?)')
  .bind(value).run()
```

### Type Assertions
```typescript
const data = await response.json() as { field?: type }
catch (error) { return c.json({ error: (error as Error).message }, 500) }
```

### Adding Routes
Follow existing pattern in `src/index.ts`:
```typescript
app.get('/api/endpoint', async (c) => {
  // Use c.env.DB for database
  return c.json({ data })
})
```

### Modifying UI
All HTML is in the template literal in `src/index.ts`. Search for section names, element IDs, or nearby text to find the right location. Remember the template literal escaping rules above.

---

## Features Summary

### Implemented
- Discord OAuth login
- Character management (multiple characters per user)
- Equipment sets per character with account type (F2P/Premium/Platinum)
- Inventory management with YAML import (`enh_export.lic` Lich script)
- Locked items & slot blockers (non-enhancive functional items)
- Alert goals with stat/skill matching, preferred slots, nugget pricing
- Useless skills per character (purple rendering, useful sum calculation)
- Default sort preferences (total sum vs match sum vs DB order)
- Enhancive summary with item breakdown tooltips (collapsible)
- Slot usage visualization with item name tooltips
- Recommendation engine
- Discord DM alerts on matching items
- Scrape health monitoring with Discord alerts
- Dark mode (beta)
- Table virtualization (infinite scroll, 100 rows/batch)
- Hourly cron scraping of 9 towns

### Key Constants
- `STAT_CAP`: 40
- `SKILL_CAP`: 50
- Nugget threshold: 25,000,000 silvers (hardcoded)
- Slot limits vary by account type (see `src/constants.ts`)

---

## TODO / Future Work

### High Priority
- Tailwind CSS production build (dev CDN ~2MB → purged ~50KB)
- **Swap Group-Aware Recommendation Engine** (see `DecisionBrain.md` for full logic, `SWAP_GROUP_ENGINE.md` for swap group definitions)
- Separate filters for item types (worn/weapons/containers)

### Medium Priority
- Numeric bonus filtering (e.g., "Strength > 5")
- Search syntax expansion (`key:value` pairs)
- "Show sold items" toggle
- Alert only on NEW items
- Test Alert button
- Configurable nugget threshold
- Re-enable bulk text import

### Low Priority
- Responsive card view for mobile
- What-if / Wishlist feature
- Price history tracking
- Enchant level filter

### Technical Debt
- Rate limiting on API endpoints
- Better error handling in Discord OAuth
- Vectorized match calculation
- Remove YAML files from repo
- Lint warnings cleanup

---

## Debugging

```bash
wrangler tail                    # Live production logs
wrangler d1 execute enhancive-db --remote --command="SELECT ..."  # Query prod DB
curl https://gs4-enhancive-shopper.rpgfilms.workers.dev/api/items  # Test API
```

---

*Last updated: 2026-03-16*
