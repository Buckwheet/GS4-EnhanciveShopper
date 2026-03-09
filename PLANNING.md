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

## Open Questions
1. What tech stack? (Python/Flask, Node/Express, Go, Rust?)
2. Database? (PostgreSQL, SQLite, MongoDB?)
3. Frontend framework? (React, Vue, Svelte, HTMX?)
4. Notification method?
5. Hosting platform?
6. How to handle "replacement" logic complexity?
7. Should we support importing from Nisugi's enhancive tracker?

## Next Steps
1. Decide on tech stack based on hosting cost analysis
2. Set up basic project structure
3. Build scraper with update detection
4. Design database schema
