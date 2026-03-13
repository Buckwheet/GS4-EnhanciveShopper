# CLAUDE.md - GS4 Enhancive Shopper Project Guide

## Project Overview
Cloudflare Workers application that scrapes GemStone IV enhancive items, matches them against user goals, and sends Discord notifications. Built with Hono framework, D1 database, and Cloudflare AI.

**Live URL:** https://gs4-enhancive-shopper.rpgfilms.workers.dev  
**Repository:** https://github.com/Buckwheet/GS4-EnhanciveShopper

---

## Architecture

### Tech Stack
- **Runtime:** Cloudflare Workers (V8 isolates)
- **Framework:** Hono (lightweight web framework)
- **Database:** Cloudflare D1 (SQLite)
- **AI:** Cloudflare Workers AI (@cf/meta/llama-3.1-8b-instruct)
- **Notifications:** Discord Bot API
- **Linting:** Biome (v2.4.6)
- **Type Checking:** TypeScript (strict mode)

### Deployment
- **Deploy Command:** `cmd.exe /c deploy-enhancive.bat` (from `/mnt/c/Users/rpgfi`)
- **Pre-commit Hooks:** Husky runs `tsc --noEmit` and `biome lint ./src`
- **CI/CD:** GitHub Actions auto-deploys on push to main
- **Security:** Dependabot enabled for weekly npm updates

---

## File Structure

### Core Application Files
```
src/
├── index.ts          (166KB) - Main application, all routes, UI, scheduled jobs
├── scraper.ts        (1.9KB) - Fetches items from GS4 API
├── matcher.ts        (3KB)   - Matches items against user goals
├── parser.ts         (4.9KB) - Parses enhancive item descriptions
├── discord.ts        (1.5KB) - Discord DM sending
├── constants.ts      (1.3KB) - SLOT_LIMITS configuration
├── types.ts          (466B)  - TypeScript type definitions
└── migrate-hierarchy.ts (3KB) - Database migration utility
```

### Configuration Files
```
biome.json           - Linting config (noExplicitAny disabled)
tsconfig.json        - TypeScript config (strict mode)
wrangler.toml        - Cloudflare Workers config
package.json         - Dependencies and scripts
.husky/pre-commit    - Git hooks
.github/
├── workflows/ci.yml - Auto-deploy on push
└── dependabot.yml   - Weekly security updates
```

### Documentation Files
```
SESSION_PROGRESS_*.md  - Development session logs
PROJECT_STEERING.md    - Project roadmap and decisions
SLOT_SWATCH_DATA.md    - Slot usage tracking data
schema.sql             - Database schema
migration_*.sql        - Database migrations
```

---

## Key Code Locations

### Main Application (`src/index.ts`)
**Critical Functions:**
- `countSlotUsage()` - Lines 13-18 - Calculates slot usage per account type
- `scheduled()` - Lines 3653-3752 - Hourly cron job (scrape → match → notify)

**API Routes:**
- `/` - Main UI (single-page app with Tailwind CSS)
- `/api/oauth/callback` - Discord OAuth flow
- `/api/set-goals` - CRUD for user goals
- `/api/inventory` - User inventory management
- `/api/chat` - AI chat interface (Cloudflare AI)
- `/api/test-dm` - Test Discord notifications

**UI Sections:**
- Lines 140-200 - Goal form with slot checkboxes
- Lines 175-185 - Nugget slot with toggle price option (ml-6 indent)
- Lines 776 - Goal display with preferred slots
- Lines 1150-1180 - Edit goal logic (shows nugget price if checked)
- Lines 1990-2010 - Event listeners (nugget checkbox toggle)

### Scraper (`src/scraper.ts`)
- `scrapeEnhancives()` - Fetches from `https://gs4-enhancive-shopper.rpgfilms.workers.dev/api/items`
- Returns: `{ id, name, town, shop, cost, enchant, worn, enhancives, is_permanent }`

### Matcher (`src/matcher.ts`)
- `matchGoalsToItems()` - Compares items against user goals
- Filters by: stat, min_boost, max_cost, preferred_slots, nugget pricing
- Sends Discord DMs if notifications enabled

### Parser (`src/parser.ts`)
- `parseEnhanciveDescription()` - Extracts enhancive data from item descriptions
- Handles: stats, boosts, charges, permanence

### Discord (`src/discord.ts`)
- `sendDiscordDM()` - Sends DM via Discord Bot API
- `formatItemAlert()` - Formats item match message

---

## Database Schema

### Tables
```sql
users                 - Discord OAuth users
characters            - User's game characters
user_goals            - Item search goals (stat, boost, slots, pricing)
user_inventory        - Owned items
items                 - Scraped enhancive items
goal_sets             - Hierarchical goal organization
```

### Key Relationships
- `users.discord_id` → `characters.discord_id`
- `characters.id` → `user_goals.character_id`
- `user_goals.goal_set_name` → `goal_sets.name`

### Important Columns
- `user_goals.preferred_slots` - Comma-separated slot names (e.g., "wrist,nugget")
- `user_goals.include_nugget_price` - Boolean (0/1) for +25M pricing
- `user_goals.account_type` - F2P/Premium/Platinum (affects slot limits)
- `items.enhancives_json` - JSON array of enhancive data

---

## Common Tasks

### Adding a New Route
1. Add route handler in `src/index.ts` (search for `app.get()` or `app.post()`)
2. Follow pattern: `app.get('/api/endpoint', async (c) => { ... })`
3. Use `c.env.DB` for database queries
4. Return JSON: `return c.json({ data })`

### Modifying UI
1. Find HTML in `src/index.ts` (search for the section name)
2. UI uses Tailwind CSS classes inline
3. JavaScript event listeners at bottom of file (lines 1970+)
4. Form IDs: `goalStat`, `goalBoost`, `goalMaxCost`, `goalNuggetCheckbox`, `goalNuggetPrice`

### Database Queries
```typescript
// Select
const result = await c.env.DB.prepare('SELECT * FROM users WHERE discord_id = ?')
  .bind(discordId)
  .first()

// Insert
await c.env.DB.prepare('INSERT INTO users (discord_id, username) VALUES (?, ?)')
  .bind(discordId, username)
  .run()

// Update
await c.env.DB.prepare('UPDATE users SET username = ? WHERE discord_id = ?')
  .bind(username, discordId)
  .run()
```

### Type Assertions (for TypeScript errors)
```typescript
// JSON responses
const data = await response.json() as { field?: type }

// Error handling
catch (error) {
  return c.json({ error: (error as Error).message }, 500)
}

// Record indexing
const value = (record as Record<string, number>)[key]
```

---

## Development Workflow

### Local Development
```bash
cd /home/rpgfilms/enhancive-alert
npm run dev              # Start local server
npm run lint             # Run Biome linter
npm run typecheck        # Run TypeScript checks
```

### Deployment
```bash
cd /mnt/c/Users/rpgfi
cmd.exe /c deploy-enhancive.bat   # Deploy to Cloudflare
```

### Git Workflow
```bash
cd /home/rpgfilms/enhancive-alert
git add -A
git commit -m "message"  # Pre-commit hook runs tsc + biome
git push                 # Triggers GitHub Actions deploy
```

### Database Migrations
```bash
# Create migration
wrangler d1 execute enhancive-db --local --file=migration_name.sql

# Apply to production
wrangler d1 execute enhancive-db --remote --file=migration_name.sql
```

---

## Frequently Accessed Code

### Slot Limits Configuration
**File:** `src/constants.ts`
```typescript
export const SLOT_LIMITS = {
  F2P: { /* limits */ },
  Premium: { /* limits */ },
  Platinum: { /* limits */ }
}
```

### Nugget Pricing Logic
**File:** `src/index.ts`
- **UI Toggle:** Lines 1990-2010 (event listener)
- **Form Display:** Lines 175-185 (checkbox + hidden price option)
- **Edit Logic:** Lines 1165-1180 (show/hide based on goal data)
- **Save Logic:** Lines 1995 (read checkbox value)

### Scheduled Job (Hourly Scrape)
**File:** `src/index.ts` - Lines 3653-3752
```typescript
async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext) {
  // 1. Scrape items
  // 2. Match against goals
  // 3. Send Discord notifications
}
```

### Discord OAuth Flow
**File:** `src/index.ts`
- **Callback Route:** Search for `/api/oauth/callback`
- **Token Exchange:** Uses `DISCORD_CLIENT_ID` and `DISCORD_CLIENT_SECRET`
- **User Creation:** Inserts into `users` table

---

## Debugging Tips

### Check Logs
```bash
wrangler tail  # Live logs from production
```

### Test Discord Notifications
1. Visit: `https://gs4-enhancive-shopper.rpgfilms.workers.dev/api/test-dm?discord_id=YOUR_ID`
2. Check Discord for DM

### Database Queries
```bash
wrangler d1 execute enhancive-db --remote --command="SELECT * FROM users LIMIT 5"
```

### TypeScript Errors
- Most errors fixed with type assertions: `value as Type`
- Check `biome.json` for disabled rules
- Run `npm run typecheck` to see all errors

---

## Recent Changes (2026-03-13)

### Completed
- ✅ Fixed all 27 TypeScript errors with type assertions
- ✅ Fixed all Biome linting errors (auto-fixed with `--write --unsafe`)
- ✅ Enabled pre-commit hooks (tsc + biome)
- ✅ Added Dependabot for security updates
- ✅ Improved nugget slot UI (toggle visibility for price option)
- ✅ Migrated biome.json schema from 1.9.4 to 2.4.6

### Known Issues
- None currently

### Next Steps
- Monitor Dependabot PRs for dependency updates
- Consider adding more AI chat features
- Improve slot usage visualization

---

## Memory System

### Use Code Intelligence Tools
Instead of grepping, use:
```bash
# Find symbols (functions, classes, types)
code search_symbols <symbol_name>

# Get file structure
code get_document_symbols <file_path>

# Lookup specific symbols
code lookup_symbols <symbol1> <symbol2>
```

### Common Searches
- **Find route handlers:** Search for `app.get` or `app.post`
- **Find UI sections:** Search for HTML comments or section IDs
- **Find database queries:** Search for `c.env.DB.prepare`
- **Find type definitions:** Check `src/types.ts`

---

## Contact & Resources

- **Discord Bot Token:** Stored in Cloudflare Workers secrets
- **Database ID:** `7f60fe28-3ccd-4d23-9e70-6d6749c6c4ed`
- **Wrangler Version:** 3.x (upgrade to 4.x recommended)
- **Node Version:** 20.x

---

*Last Updated: 2026-03-13*
*Maintained by: rpgfilms*
