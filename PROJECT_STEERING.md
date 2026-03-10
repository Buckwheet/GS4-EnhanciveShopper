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

## Architecture Decisions

### Hosting
- **Platform**: Cloudflare Workers (free tier)
- **Rationale**: Best free tier for our workload, no cold starts, global edge network
- **Cost**: $0/month for 1500+ users (within free tier limits)

### Data Flow
1. Hourly cron checks source site for updates
2. Only scrapes if "Last Updated" timestamp changed
3. Compares scraped items to existing database
4. Only writes changed/new items (minimize D1 writes)
5. Matching engine checks new items against user goals
6. Discord bot sends DMs for matches (1 msg/second rate limit)

### Database Strategy
- **Availability Flag**: Items marked `available = 0` when sold (not deleted)
- **Preserves History**: Track when items first appeared (`scraped_at`) and last seen (`last_seen`)
- **Write Optimization**: Only update changed items to stay within D1 free tier (100k writes/day)

## Development Workflow

### Code Quality (TODO)
- [ ] **Add Husky pre-commit hooks**
- [ ] **Add Biome linter**
- [ ] **Pre-commit checks**:
  - `tsc --noEmit` (TypeScript type checking)
  - `biome lint` (code linting)
  - Both must pass before commit allowed

### Setup Instructions
```bash
# Install dependencies
npm install

# Add Husky
npm install --save-dev husky
npx husky init

# Add Biome
npm install --save-dev @biomejs/biome
npx @biomejs/biome init

# Configure pre-commit hook (.husky/pre-commit)
#!/bin/sh
npm run typecheck
npm run lint

# Add scripts to package.json
"scripts": {
  "typecheck": "tsc --noEmit",
  "lint": "biome lint ./src",
  "format": "biome format --write ./src"
}
```

## Feature Roadmap

### Completed
- ✅ Discord OAuth authentication
- ✅ User goal management with multiple sets (character builds)
- ✅ Hourly scraper with smart update detection
- ✅ Matching engine with partial stat matching
- ✅ Discord DM notifications with rate limiting
- ✅ Duplicate alert prevention
- ✅ Slot selection via checkboxes
- ✅ Goal set management (create/delete/switch)

### In Progress
- 🔄 Code quality tooling (Husky + Biome)

### Planned
- [ ] Separate filters for item types (worn equipment vs weapons vs containers)
- [ ] "Show sold items" toggle
- [ ] Alert history in UI
- [ ] "Test Alert" button
- [ ] Character profile builder
- [ ] Price history tracking
- [ ] Recently sold items section

## Performance Targets
- **D1 Writes**: <50k/day (50% of free tier)
- **D1 Reads**: <500k/day (10% of free tier)
- **Worker Requests**: <50k/day (50% of free tier)
- **Scrape Time**: <5 seconds for 5,700 items
- **Alert Latency**: <2 minutes from item appearing to DM sent

## Monitoring
- Cloudflare Dashboard: Usage metrics
- GitHub Actions: Deployment status
- Discord: Alert delivery confirmation

## Known Issues
- Template literals in embedded JavaScript can break esbuild (use string concatenation)
- Discord rate limits: 1 message/second (handled with delays)
- D1 Console doesn't support multi-statement SQL (run one at a time)

## Contributing Guidelines
1. All code must pass TypeScript type checking
2. All code must pass Biome linting
3. Test locally before pushing
4. Use meaningful commit messages
5. Update this document when making architectural decisions

## Deployment
- **Automatic**: Push to `main` branch triggers GitHub Actions
- **Manual**: `npx wrangler deploy` (requires Cloudflare auth)
- **Secrets**: Set in Cloudflare Dashboard (not in code)

## Support
- Discord setup: See `DISCORD_SETUP.md`
- Database migrations: See `migration_*.sql` files
- TODO items: See `TODO.md`
