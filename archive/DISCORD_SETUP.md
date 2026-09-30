# Discord Setup Instructions

## 1. Create Discord Application

1. Go to https://discord.com/developers/applications
2. Click **New Application**
3. Name it "GS4 Enhancive Shopper"
4. Go to **OAuth2** → **General**
5. Add redirect URL: `https://gs4-enhancive-shopper.rpgfilms.workers.dev/api/auth/discord/callback`
6. Copy your **Client ID** and **Client Secret**

## 2. Create Discord Bot

1. In the same application, go to **Bot**
2. Click **Add Bot**
3. Under **Privileged Gateway Intents**, enable:
   - MESSAGE CONTENT INTENT (optional, for future features)
4. Click **Reset Token** and copy the bot token
5. Under **OAuth2** → **URL Generator**:
   - Scopes: `bot`
   - Bot Permissions: `Send Messages`
   - Copy the generated URL and open it to invite the bot to your server (optional, for testing)

## 3. Set Cloudflare Secrets

Run these commands (you'll need wrangler CLI or use Cloudflare dashboard):

```bash
# Via CLI (if wrangler works)
cd ~/enhancive-alert
npx wrangler secret put DISCORD_CLIENT_ID
# Paste your Client ID

npx wrangler secret put DISCORD_CLIENT_SECRET
# Paste your Client Secret

npx wrangler secret put DISCORD_BOT_TOKEN
# Paste your Bot Token

npx wrangler secret put DISCORD_REDIRECT_URI
# Paste: https://gs4-enhancive-shopper.rpgfilms.workers.dev/api/auth/discord/callback
```

**OR via Cloudflare Dashboard:**

1. Go to https://dash.cloudflare.com/0a33eb8c3f8d91e6eb1e78918b74bf12/workers/services/view/gs4-enhancive-shopper/production/settings/variables
2. Under **Environment Variables**, add:
   - `DISCORD_CLIENT_ID` = your client ID
   - `DISCORD_CLIENT_SECRET` = your client secret (encrypted)
   - `DISCORD_BOT_TOKEN` = your bot token (encrypted)
   - `DISCORD_REDIRECT_URI` = `https://gs4-enhancive-shopper.rpgfilms.workers.dev/api/auth/discord/callback`

## 4. Test Authentication

1. Deploy the updated code
2. Visit https://gs4-enhancive-shopper.rpgfilms.workers.dev/
3. Click "Login with Discord"
4. Authorize the application
5. You should see "Welcome, [username]!"

## 5. How It Works

- Users log in with Discord OAuth
- They create "goals" (e.g., "Alert me when +5 Strength items under 10M appear")
- Hourly cron job scrapes new items
- Matching engine checks if any new items match user goals
- Bot sends Discord DM to users with matching items
- No email, no external services, $0 cost!
