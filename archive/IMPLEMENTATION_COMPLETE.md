# Discord Authentication & Notifications - Implementation Complete

## What Was Built

### 1. Discord OAuth Authentication
- **Login with Discord** button on homepage
- OAuth2 flow that opens popup window
- Stores user info in localStorage
- Creates/updates user record in database on login

### 2. User Goals System
- **Goals Management UI** (visible after login)
- Users can create alert goals with:
  - **Stat**: Which enhancive stat to watch (e.g., "Strength", "Wisdom")
  - **Min Boost**: Minimum boost value (e.g., +5)
  - **Max Cost**: Optional price limit
  - **Preferred Slots**: Optional comma-separated list (e.g., "arms, hands")
- View all goals
- Delete goals

### 3. Matching Engine
- Runs after every scrape (hourly cron + manual trigger)
- Checks each new item against all user goals
- Matches based on:
  - Stat name and boost value
  - Cost constraint (if specified)
  - Slot preference (if specified)
- Prevents duplicate alerts (tracks in `alerts` table)

### 4. Discord Bot Notifications
- Sends DM to users when matches found
- Formatted message with item details:
  - Name, town, shop, cost
  - Slot and enhancives
  - Link to shops.elanthia.online
- Tracks delivery status

## API Endpoints Added

```
GET  /api/auth/discord                    - Redirect to Discord OAuth
GET  /api/auth/discord/callback           - OAuth callback handler
GET  /api/goals?discord_id=<id>           - Get user's goals
POST /api/goals                           - Create new goal
DELETE /api/goals/:id                     - Delete goal
```

## Files Created/Modified

**New Files:**
- `src/discord.ts` - Discord DM helper functions
- `src/matcher.ts` - Matching engine logic
- `DISCORD_SETUP.md` - Setup instructions

**Modified:**
- `src/index.ts` - Added OAuth routes, goals API, UI with login/goals
- `src/types.ts` - Added Discord env vars
- `wrangler.toml` - Added env var comments

## Setup Required (Before It Works)

### 1. Create Discord Application & Bot
Follow `DISCORD_SETUP.md` to:
1. Create Discord app at https://discord.com/developers/applications
2. Get Client ID, Client Secret, Bot Token
3. Add OAuth redirect URL

### 2. Set Cloudflare Secrets
Go to: https://dash.cloudflare.com/0a33eb8c3f8d91e6eb1e78918b74bf12/workers/services/view/gs4-enhancive-shopper/production/settings/variables

Add these environment variables:
- `DISCORD_CLIENT_ID` = (your client ID)
- `DISCORD_CLIENT_SECRET` = (your client secret) - **encrypted**
- `DISCORD_BOT_TOKEN` = (your bot token) - **encrypted**
- `DISCORD_REDIRECT_URI` = `https://gs4-enhancive-shopper.rpgfilms.workers.dev/api/auth/discord/callback`

### 3. Test
1. Wait for deployment (~30 seconds)
2. Visit https://gs4-enhancive-shopper.rpgfilms.workers.dev/
3. Click "Login with Discord"
4. Create a goal
5. Trigger scrape: `curl -X POST https://gs4-enhancive-shopper.rpgfilms.workers.dev/api/scrape`
6. Check Discord DMs for alerts!

## How Users Will Use It

1. **Visit site** → Click "Login with Discord"
2. **Authorize** the app
3. **Create goals** like:
   - "Alert me when +5 Strength items appear"
   - "Alert me when +10 Wisdom items under 50M appear in arms/hands slots"
4. **Get notified** via Discord DM when matches are found
5. **Manage goals** - add/delete as needed

## Cost: $0/month
- Discord OAuth: Free
- Discord Bot: Free
- Discord DMs: Free (unlimited)
- Cloudflare Workers: Free tier (100k requests/day)
- D1 Database: Free tier (5M reads/day)

## Next Steps (Optional Enhancements)
- Add "Test Alert" button to verify Discord DMs work
- Show alert history in UI
- Add more filter options (enchant level, specific towns)
- Email notifications as backup (would add cost)
- Character profile builder (track multiple builds)
