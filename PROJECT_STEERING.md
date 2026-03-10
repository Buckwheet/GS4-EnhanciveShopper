# Project Steering Document

## Project Overview
GS4 Enhancive Shopper - A multi-user web application that monitors GemStone IV player shop listings and alerts users via Discord when enhancive items matching their build requirements become available.

## Tech Stack
- **Runtime**: Cloudflare Workers (TypeScript)
- **Framework**: Hono
- **Database**: Cloudflare D1 (SQLite)
- **Authentication**: Discord OAuth
- **Notifications**: Discord Bot DMs
- **Deployment**: GitHub Actions → Cloudflare Workers
- **Frontend**: Vanilla HTML/JS + Tailwind CSS

## Current State (as of 2026-03-10)

### Completed Features
1. **Authentication & User Management**
   - Discord OAuth login/logout
   - User session persistence in localStorage
   - Multi-user support with discord_id as primary key

2. **Goal Set System**
   - Create/delete/switch between multiple goal sets (character builds)
   - Account type selection: F2P/Premium/Platinum
   - Each set tracks: goals, inventory, character stats, skill ranks
   - Empty sets stay visible in dropdown (tracked in memory)
   - Warning shown when no sets exist, buttons disabled

3. **Item Scraping & Database**
   - Hourly cron job checks source site for updates
   - Only scrapes when "Last Updated" timestamp changes
   - Optimized writes: only insert new items, mark removed as unavailable
   - Tracks: `available`, `last_seen`, `unavailable_since`
   - Auto-cleanup: deletes items unavailable >72 hours
   - Current: ~5,700 items, ~50-100 writes/scrape (vs 11k before optimization)

4. **Inventory Management System**
   - Parse item text from game output
   - Auto-detect: enhancives, slot, permanent/temporary
   - Manual slot selection via radio buttons
   - CRUD operations for user inventory
   - Stored per goal set

5. **Character Data Management**
   - Parse stats from `>stats` command (Ascended Bonus column)
   - Parse skills from `>skill base` command (Actual Ranks column)
   - Stored as JSON per goal set
   - Modal UI for pasting and parsing

6. **Matching & Alerts**
   - Partial case-insensitive stat matching ("strength" matches "Strength Base")
   - Only alerts on NEW items (not existing)
   - Prevents duplicate alerts (tracks in `alerts` table)
   - Discord DM with item details
   - Rate limiting: 1 message/second

7. **My Matches Page**
   - Shows items user was alerted about
   - Separates: Available Now vs Recently Sold (72 hours)
   - Displays sold timestamp

## Database Schema

### Tables
- **users**: discord_id, discord_username, email, password_hash, created_at, last_login
- **user_goals**: id, discord_id, stat, min_boost, max_cost, preferred_slots, goal_set_name, account_type, base_stats (JSON), skill_ranks (JSON), created_at
- **user_inventory**: id, discord_id, goal_set_name, item_name, slot, enhancives_json, is_permanent, created_at
- **shop_items**: id, name, town, shop, cost, enchant, worn, enhancives_json, scraped_at, last_seen, available, unavailable_since
- **alerts**: id, discord_id, item_id, goal_id, sent_at, delivered
- **tracked_stats**: id, discord_id, goal_set_name, stat_or_skill, is_tracked
- **metadata**: key, value (stores last_updated timestamp)

### Key Files
- `src/index.ts` - Main Hono app with all routes and UI
- `src/scraper.ts` - Scrapes 9 towns, parses enhancives
- `src/matcher.ts` - Matching engine for alerts
- `src/discord.ts` - Discord DM helper functions
- `src/parser.ts` - Parse items, stats, skills from game text
- `src/constants.ts` - Slot limits by account type, stat/skill caps
- `src/types.ts` - TypeScript interfaces

## Slot Limits by Account Type

### F2P/Standard (same limits)
- Pin: 8, Head: 1, Hair: 1, Single Ear: 1, Both Ears: 1
- Neck: 3, Shoulder (slung): 2, Shoulders (draped): 1
- Chest: 1, Front: 1, Back: 1, Arms: 1
- Wrist: 2, Hands: 1, Fingers: 2
- Waist: 1, Belt: 3, Legs: 1, Ankle: 1, Feet: 1

### Premium
- Same as F2P except:
- Single Ear: 2, Both Ears: 2, Neck: 4, Wrist: 3, Fingers: 3

### Platinum
- Same as Premium except:
- Single Ear: 3, Both Ears: 3, Neck: 5, Wrist: 4, Fingers: 4

## Enhancive Calculations

### Stats: Base vs Bonus
- "+4 Constitution Base" = 4 stat points
- "+4 Constitution Bonus" = 8 stat points (double)
- **Cap**: +40 from enhancives (regardless of base stat)

### Skills: Ranks vs Bonus
- Ranks convert to bonus based on current rank:
  - Ranks 1-10: +5 bonus per rank
  - Ranks 11-20: +4 bonus per rank
  - Ranks 21-30: +3 bonus per rank
  - Ranks 31-40: +2 bonus per rank
  - Ranks 41+: +1 bonus per rank
- "+2 Edged Weapons Bonus" = always +2 bonus
- **Cap**: +50 from enhancives (regardless of base skill)

## Next Steps (Priority Order)

### 1. Summary Dashboard (HIGH PRIORITY)
**Goal**: Show user's total enhancive bonuses vs caps
- Display all stats/skills from inventory
- Calculate total bonus per stat/skill
- Color code: 🔴 Under cap, 🟢 At cap, 🔵 Over cap (wasted)
- Checkbox per stat/skill: tracked (user cares) vs untracked
- Show: "STR: 10 base + 35 enhancives = 45 total [35/40 cap] 🔴"
- Always visible (not in modal)

**Implementation**:
- Add `/api/summary?discord_id=X&goal_set_name=Y` endpoint
- Calculate totals from user_inventory items
- Use base_stats and skill_ranks from user_goals
- Apply normalization (Base vs Bonus, Ranks vs Bonus)
- Return: { stats: {STR: {base: 10, enhancive: 35, total: 45, cap: 40}}, skills: {...} }
- UI: New section below goals, always visible

### 2. Slot Usage Validation
**Goal**: Prevent adding items that exceed slot limits
- When adding item to inventory, check current slot usage
- Compare against account type limits (from constants.ts)
- Show error: "You have 3/3 neck slots filled (Premium). Remove an item first."
- Display slot usage in inventory modal: "Neck: 2/3 used"

### 3. Replacement Suggestions
**Goal**: Alert when new item is better than equipped item
- When matching finds item, check if user has that slot filled
- Calculate if new item is better (higher normalized value)
- Alert: "New +5 Dex Bonus ring could replace your +2 Dex Base ring (net gain: +6 Dex)"
- Show in My Matches with comparison

### 4. Item Type Filtering (from TODO)
**Goal**: Distinguish weapons vs worn equipment vs containers
- Parse additional fields from item text
- Add `item_type` column to shop_items
- Separate filters in UI
- Issue: "shoulder" slot used for both slung weapons and worn items

### 5. Code Quality (from TODO)
- Add Husky pre-commit hooks
- Add Biome linter
- Enforce `tsc --noEmit` and `biome lint` before commits

## Known Issues & Workarounds

1. **Empty sets disappear after deleting last goal**
   - Fixed: Track sets in memory (`allKnownSets`)
   - Sets persist even with no goals

2. **Character data not saved for empty sets**
   - Fixed: Disable "Manage Character" button until set has goals
   - Show warning: "Create an enhancive set first"

3. **Template literals break esbuild**
   - Use string concatenation in embedded JS: `'text' + var + 'text'`

4. **Discord rate limits**
   - Fixed: 1 second delay between messages
   - Tracks delivery status in alerts table

5. **D1 write quota concerns**
   - Fixed: Only write changed items (~50-100 writes/scrape vs 11k)
   - Monitor: https://dash.cloudflare.com usage dashboard

## API Endpoints

### Authentication
- `GET /api/auth/discord` - Redirect to Discord OAuth
- `GET /api/auth/discord/callback` - OAuth callback

### Goals
- `GET /api/goals?discord_id=X` - Get all goals for user
- `POST /api/goals` - Create goal (includes account_type, base_stats, skill_ranks)
- `DELETE /api/goals/:id` - Delete goal
- `PUT /api/goal-set/:discord_id/:set_name` - Update set character data

### Inventory
- `GET /api/inventory?discord_id=X&goal_set_name=Y` - Get inventory
- `POST /api/inventory` - Add item
- `DELETE /api/inventory/:id` - Remove item

### Items & Matching
- `GET /api/items` - Get all available shop items
- `POST /api/scrape` - Manual scrape trigger
- `GET /api/my-matches?discord_id=X` - Get user's alerted items
- `POST /api/test-dm` - Test Discord DM (for debugging)
- `GET /api/debug/alerts?discord_id=X` - Debug matching (shows goals, alerts, sample matches)

### Health
- `GET /api/health` - Health check

## Deployment & Secrets

### Cloudflare Secrets (set in dashboard)
- `DISCORD_CLIENT_ID` - Discord app client ID
- `DISCORD_CLIENT_SECRET` - Discord app secret
- `DISCORD_BOT_TOKEN` - Discord bot token
- `DISCORD_REDIRECT_URI` - OAuth callback URL

### GitHub Secrets
- `CLOUDFLARE_API_TOKEN` - For automated deployments

### D1 Database
- Database ID: `7f60fe28-3ccd-4d23-9e70-6d6749c6c4ed`
- Name: `enhancive-db`
- Console: https://dash.cloudflare.com/0a33eb8c3f8d91e6eb1e78918b74bf12/workers/d1/7f60fe28-3ccd-4d23-9e70-6d6749c6c4ed

## Performance Metrics (Current)
- **D1 Writes**: ~2-5k/day (2-5% of free tier) ✅
- **D1 Reads**: ~10-20k/day (0.4% of free tier) ✅
- **Worker Requests**: ~5-10k/day (5-10% of free tier) ✅
- **Items in DB**: 5,702 enhancive items
- **Scrape frequency**: Hourly (only when source updates)
- **Average scrape time**: 3-5 seconds

## Testing Checklist
- [ ] Create new goal set with account type
- [ ] Parse and save character stats
- [ ] Parse and save skill ranks
- [ ] Add item to inventory (paste text, auto-parse, select slot)
- [ ] View inventory items
- [ ] Delete item from inventory
- [ ] Create goal and verify alert
- [ ] Check My Matches page
- [ ] Delete goal set (verify inventory also deleted)
- [ ] Test with empty set (buttons disabled, warning shown)

## Contributing
1. All changes must deploy successfully via GitHub Actions
2. Test on live site before marking complete
3. Update this document when adding features
4. Run migrations in D1 Console after schema changes
5. Monitor Cloudflare usage dashboard for quota issues
