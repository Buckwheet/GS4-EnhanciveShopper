# Enhancive Alert System - Planning Document

## Project Goal
Create a web application that monitors GemStone IV player shop listings and alerts users when items matching their enhancive build requirements become available.

## Core Features

### 1. User Build Management
- Users define their current enhancive setup (what they have equipped)
- Users define target goals (what stats/skills they want to reach)
- Users specify available slots (e.g., "ring slot open")
- Users set price limits (optional per criteria)

### 2. Shop Data Monitoring
- Check source site (https://shops.elanthia.online) hourly for updates
- Only scrape if "Last updated" timestamp has changed
- Parse all 9 town JSON files for enhancive items
- Store in database with timestamp

### 3. Matching Engine (TODO - Complex Logic)
- Compare new listings against user criteria
- **DEFERRED**: Smart replacement logic (e.g., swap +3 item for +8 item)
- **DEFERRED**: Determine if partial matches should notify
- **DEFERRED**: Priority system (price vs. stats vs. exact match)
- **DEFERRED**: Multi-item optimization (best combination to reach goal)

#### Future: Intelligent Goal Optimization & Decision Matrix
**See: `FUTURE_ENHANCEMENT_DECISION_MATRIX.md` for full details**

**Key Concept**: When users say "Strength 20", they mean "build me a set that provides 20 total Strength", not "find one item with +20 Strength"

**Current State (March 2026)**:
- Goals are min_boost filters (e.g., "find items with 10+ Strength")
- User manually evaluates recommendations
- No automatic set building or total calculation

**Future Vision**:
1. **Total Target Goals**: User sets "I want 20 total Strength"
2. **Gap Calculation**: System calculates current total from inventory, determines gap
3. **Set Builder**: Generates optimal combinations to reach target
4. **Smart Optimization**: Considers cost, Base vs Bonus, slot value, permanence
5. **Complete Recommendations**: "Buy these 3 items for 250k to reach your goal"

**Implementation Phases**:
- Phase 1: Total target goals (vs min_boost filters)
- Phase 2: Set builder with combinations
- Phase 3: Base vs Bonus intelligence (prefer Base)
- Phase 4: Slot optimization (use cheap slots first)
- Phase 5: Multi-goal optimization (items with multiple stats)

**Priority**: High (transforms tool from search engine to optimization engine)
**Complexity**: High (combinatorial optimization, knapsack problem variant)

### 4. Notification System
- **DEFERRED**: Choose notification method (email, Discord, Telegram, SMS, push)
- Include item details: name, stats, price, location, shop
- Link to item on source site

### 5. User Preferences (TODO)
- **DEFERRED**: Notify on partial matches vs. exact matches only
- **DEFERRED**: Notify on items with extra enhancives user doesn't need
- **DEFERRED**: Price priority settings

## Technical Architecture

### Data Sources
- Primary: https://shops.elanthia.online/data/{town}.json (9 towns)
- Update check: Parse main page for "Last updated" timestamp
- Reference: https://nisugi.github.io/enhancives/ (for UX inspiration)

### Tech Stack (TBD)
- **Backend**: ?
- **Database**: ?
- **Frontend**: ?
- **Hosting**: Cheapest option with great performance
- **Scheduler**: Cron/scheduled task for hourly checks

### Hosting Considerations
- Multi-user system (needs auth, user data storage)
- Minimal cost priority
- Good performance required
- Options to evaluate:
  - Serverless (AWS Lambda, Cloudflare Workers, Vercel)
  - VPS (DigitalOcean, Hetzner, Linode)
  - PaaS (Railway, Render, Fly.io)
  - Static + edge functions

## Data Model (Draft)

### Users
- id, email, password_hash, created_at

### User_Items (Current Equipment)
- user_id, slot, item_name, enhancives (JSON)

### User_Goals
- user_id, stat/skill, current_value, target_value, max_price

### User_Slots
- user_id, slot_name, is_available

### Shop_Items
- id, name, town, shop, cost, enchant, worn, enhancives (JSON), scraped_at

### Alerts (Notification Queue)
- user_id, item_id, matched_criteria, sent_at, read_at

## Development Phases

### Phase 1: Core Infrastructure
- [ ] Set up project structure
- [ ] Choose tech stack
- [ ] Set up database schema
- [ ] Build scraper with update detection
- [ ] Store scraped data

### Phase 2: Basic Matching
- [ ] Simple criteria matching (exact stat, slot, price)
- [ ] No replacement logic yet
- [ ] Basic notification (log to console/file)

### Phase 3: User Management
- [ ] User registration/login
- [ ] Build definition UI
- [ ] Goal setting UI
- [ ] View matched items

### Phase 4: Smart Matching (Complex)
- [ ] Replacement optimization logic
- [ ] Multi-item combinations
- [ ] Preference system

### Phase 5: Notifications
- [ ] Choose notification method
- [ ] Implement delivery system
- [ ] User notification preferences

### Phase 6: Polish & Deploy
- [ ] Choose hosting platform
- [ ] Deploy
- [ ] Monitoring/logging
- [ ] Documentation

## Tech Stack Decision ✅

**Hosting**: Cloudflare (Free tier sufficient for 1500+ users)
**Language**: TypeScript
**Backend**: Hono
**Frontend**: React + Vite (TBD: could use HTMX for simplicity)
**Database**: D1 (SQLite)
**Cron**: Cloudflare Cron Triggers
**Auth**: TBD (Cloudflare Access or JWT)

## Open Questions
1. ~~What tech stack?~~ ✅ Decided: TypeScript + Hono + D1
2. ~~Hosting platform?~~ ✅ Decided: Cloudflare
3. Notification method? (Email, Discord, Telegram, SMS, in-app)
4. Frontend: React or HTMX? (React = richer UX, HTMX = simpler)
5. How to handle "replacement" logic complexity? (DEFERRED)
6. Should we support importing from Nisugi's enhancive tracker? (Nice to have)

## Next Steps
1. ✅ Decide on tech stack and hosting
2. Initialize Cloudflare Workers project with Hono
3. Set up D1 database schema
4. Build scraper with smart update detection (only scrape when source changes)
5. Create basic API endpoints
6. Build simple frontend for user registration and goal setting

## TODO

### YAML Import Improvements
- **Enhancive matching by item_id**: The YAML `totals` section has `item_id` on every enhancive source, and `worn_items` has matching `id`. Use ID-based matching instead of fragile name-string matching.
- **Lich script: export worn location**: The script currently doesn't export what slot each item occupies. If we add that, we can eliminate the noun-to-slot guessing entirely. Until then, the noun reverse-walk approach is a workaround.
- **Current state (March 2026)**: Noun extraction walks backwards through item name words to find a recognized noun in the slotMap. Works for most items but is inherently fragile for items with descriptive suffixes.

### Frontend Performance (from site review, March 2026)
- **Table virtualization** [HIGH]: `renderItemsTable()` renders all 5,700+ rows into the DOM at once, causing UI lag and memory pressure. Switch to virtualized list rendering (~20 visible rows at a time).
- **Tailwind CSS production build** [HIGH]: Currently loading Tailwind via dev CDN (~2MB). Compile into a purged static bundle (~50KB).

### Filtering & Search Enhancements
- **Numeric bonus filtering**: Add ability to filter by bonus value (e.g., Strength > 5), not just stat type. Range sliders or input operators.
- **Search syntax expansion**: Upgrade search to support `key:value` pairs for power users (e.g., `slot:finger bonus:str`).

### UI/UX
- **Responsive card view**: Add a card-view toggle for mobile/small viewports that stacks item data vertically instead of the 8-column table.

### Goal Analysis
- **"What-if" / Wishlist**: Auto-identify marketplace items that bridge the largest gaps in a character's current build. Related to the deferred set-builder optimization in the Future Vision section above.

### Nugget/Swatch Engine (from deep review, March 2026)
- **Configurable nugget threshold**: The 25M silver threshold for flagging weapons/runestaves as "nuggets" is hardcoded. Expose as a UI slider so users can find budget-friendly nuggets too.
- **Vectorized match calculation**: Match score recalculates on every table re-render/filter change across ~5,700 items × character stats. Refactor to treat stats as a single array for batch comparison instead of per-item iteration.

### Summary Display
- **Richer stat display**: Currently showing simple X/Y. Future: show base stat bonus + enhancive bonus = total stat value. Requires understanding that base_stats stores bonus values, not actual stat totals (e.g., WIS bonus 30 → actual stat ~100). Need to either store actual stat totals or calculate from bonus.

### Cleanup
- **Re-enable bulk text import**: The old two-textarea bulk import (paste enhancive detail + inventory location) was disabled because the YAML file import is more reliable. Re-enable later with an improved parser that handles edge cases better.
- **Lint warnings**: Unused params in recommendation-engine.ts, unused `countSlotUsage` in index.ts, useLiteralKeys. Non-blocking.
- **Remove YAML files from repo**: Mejora/Shollindal YAML files and `.Zone.Identifier` files accidentally committed. Add to .gitignore.
