# Hosting Cost Analysis (2026)

## Requirements
- Multi-user web app with authentication
- PostgreSQL database
- Scheduled hourly task (scraper)
- Good performance
- Minimal cost

## Options Evaluated

### 1. **Render** (RECOMMENDED)
**Pros:**
- Free tier: 750 hours/month (enough for 1 service always-on)
- Free PostgreSQL (90-day expiry, but can recreate)
- Native cron jobs support
- No cold starts on paid tier ($7/mo)

**Cons:**
- Free tier has cold starts (services spin down after inactivity)
- Free DB expires after 90 days

**Cost:**
- Free: $0 (with cold starts)
- Paid: $7/mo web service + $7/mo DB = $14/mo (no cold starts)

### 2. **Railway**
**Pros:**
- Great DX
- Built-in cron support
- PostgreSQL included

**Cons:**
- NO FREE TIER (removed in 2024)
- Charges from first minute
- Can get expensive with usage-based pricing

**Cost:**
- ~$5-10/mo minimum (usage-based)

### 3. **Fly.io**
**Pros:**
- Edge deployment (fast globally)
- Good for containers
- PostgreSQL support

**Cons:**
- Complex pricing
- Less beginner-friendly
- Free tier very limited

**Cost:**
- ~$5-15/mo depending on usage

### 4. **Vercel**
**Pros:**
- Excellent for Next.js/frontend
- Great free tier for frontend
- Serverless functions

**Cons:**
- No native PostgreSQL (need external DB)
- Cron jobs require paid plan ($20/mo)
- Not ideal for backend-heavy apps

**Cost:**
- Free frontend + external DB (~$0-10/mo)
- Cron requires Pro ($20/mo)

### 5. **Neon (Serverless Postgres) + Vercel/Cloudflare**
**Pros:**
- Neon free tier: 100 CU-hours/mo, 0.5GB storage
- Auto scale-to-zero
- Can pair with free frontend hosting

**Cons:**
- Need separate cron solution
- More complex setup

**Cost:**
- $0 (within free tier limits)

### 6. **Cloudflare Workers + D1 + Cron Triggers**
**Pros:**
- Generous free tier (100k requests/day)
- Built-in cron triggers (free)
- D1 database (SQLite, free tier: 5GB)
- Edge performance

**Cons:**
- D1 is SQLite (not PostgreSQL)
- Different development model (edge functions)
- Learning curve

**Cost:**
- $0 (within free tier)
- Scales cheaply ($5/mo for 10M requests)

## Recommendation

### For Absolute Cheapest: **Cloudflare Workers + D1**
- $0/month within generous free tier
- Built-in cron (free)
- Edge performance
- SQLite (D1) instead of PostgreSQL (acceptable for this use case)

### For Best Balance: **Render Free Tier**
- $0/month
- PostgreSQL included
- Cron jobs supported
- Cold starts acceptable for hourly scraper
- Easy to upgrade to $14/mo for no cold starts later

### For Production-Ready: **Render Paid**
- $14/month ($7 web + $7 DB)
- No cold starts
- PostgreSQL
- Cron jobs
- Simple, predictable pricing

## Tech Stack Recommendation

### Option A: Cloudflare (Cheapest) - RECOMMENDED
- **Frontend**: Cloudflare Pages (free)
- **Backend**: Cloudflare Workers (free tier)
- **Database**: D1 SQLite (free tier)
- **Cron**: Cloudflare Cron Triggers (free)
- **Framework**: Hono (lightweight) + HTMX or React

### Option B: Render (Easiest)
- **Frontend + Backend**: Node.js/Python on Render
- **Database**: Render PostgreSQL
- **Cron**: Render Cron Jobs
- **Framework**: Express/Flask + React/HTMX

## Cloudflare Free Tier Analysis for 1500 Daily Users

### Workers Free Tier Limits:
- **100,000 requests/day** across all Workers
- **10ms CPU time per invocation**

### D1 Free Tier Limits:
- **5 million rows read/day**
- **100,000 rows written/day**
- **5 GB total storage**

### Usage Estimation for 1500 Users/Day:

**Scenario: Active users checking their alerts**
- 1500 users × 5 page views/day = 7,500 requests/day
- Hourly scraper: 24 requests/day
- **Total: ~7,524 requests/day** ✅ Well under 100k limit

**Database Operations:**
- Scraping 5,699 enhancive items hourly: 24 × 5,699 = 136,776 rows written/day ❌ **EXCEEDS 100k limit**
- User queries: ~10,000 rows read/day ✅ Well under 5M limit

### Solution: Optimize Scraping Strategy
Instead of writing all items every hour:
1. **Check "Last updated" timestamp first** (1 request)
2. **Only scrape if timestamp changed** (saves 95%+ of writes)
3. **Use upsert logic** - only update changed items
4. **Estimated writes with optimization**: ~5,000-10,000/day ✅ Under limit

### Verdict: Cloudflare Free Tier is SUFFICIENT
With smart scraping (only when source updates), 1500 daily users will stay well within free tier limits.

## Tech Stack Decision: Cloudflare

**Selected Stack:**
- **Language**: TypeScript
- **Backend**: Hono (lightweight, fast)
- **Frontend**: React + Vite (or HTMX for simplicity)
- **Database**: D1 (SQLite)
- **Cron**: Cloudflare Cron Triggers
- **Auth**: Cloudflare Access or simple JWT

**Why this stack:**
- $0/month for 1500+ users
- TypeScript for type safety
- Hono is extremely fast and lightweight
- D1 is perfect for relational data (users, items, alerts)
- Built-in cron support
