# Setup Instructions

## 1. Create D1 Database

Run this command from PowerShell or CMD (not WSL):

```bash
cd C:\Users\rpgfi\enhancive-alert
npx wrangler d1 create enhancive-db
```

This will output something like:

```
[[d1_databases]]
binding = "DB"
database_name = "enhancive-db"
database_id = "xxxx-xxxx-xxxx-xxxx"
```

Copy the `database_id` and update `wrangler.toml` with it.

## 2. Initialize Database Schema

After creating the database, run:

```bash
npx wrangler d1 execute enhancive-db --file=./schema.sql
```

## 3. Push to GitHub

```bash
git add -A
git commit -m "Initial project setup"
git push origin main
```

This will trigger the GitHub Action to deploy to Cloudflare Workers.

## 4. Get Your Workers URL

After deployment, your app will be available at:
`https://gs4-enhancive-shopper.workers.dev` (or similar)

Check the GitHub Actions tab to see the deployment URL.
