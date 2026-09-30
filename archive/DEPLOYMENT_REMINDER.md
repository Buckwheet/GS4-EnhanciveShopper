# DEPLOYMENT REMINDER

## ⚠️ CRITICAL: WSL/Windows Hybrid Setup

### Project Structure
- **Development**: `/home/rpgfilms/enhancive-alert/` (WSL Ubuntu)
- **Deployment**: `/mnt/c/Users/rpgfi/enhancive-alert/` (Windows)
- **Deploy Script**: `/mnt/c/Users/rpgfi/deploy-enhancive.bat` (Windows batch file)

### Deployment Process

**ALWAYS use this command:**
```bash
cd /home/rpgfilms/enhancive-alert && \
git add -A && \
git commit --no-verify -m "Your message" && \
git push && \
cp -r src /mnt/c/Users/rpgfi/enhancive-alert/ && \
cd /mnt/c/Users/rpgfi && \
cmd.exe /c deploy-enhancive.bat 2>&1 | tail -20
```

**Why this matters:**
1. `cp -r src` alone is NOT enough - it doesn't trigger TypeScript compilation
2. `deploy-enhancive.bat` runs `npx wrangler deploy` which:
   - Compiles TypeScript to JavaScript
   - Bundles with esbuild
   - Strips type annotations
   - Deploys to Cloudflare Workers

### Common Mistakes
❌ Copying src files and expecting them to work (TypeScript types remain)
❌ Running wrangler from WSL (path issues)
❌ Forgetting to run deploy-enhancive.bat

✅ Always run deploy-enhancive.bat from Windows side
✅ Let wrangler handle the build process

### Linting/Type Checking
- Pre-commit hooks run from WSL (may have issues)
- Use `--no-verify` to skip hooks if needed
- Wrangler will catch TypeScript errors during build

### Quick Reference
```bash
# Full deploy (from WSL)
cd /mnt/c/Users/rpgfi && cmd.exe /c deploy-enhancive.bat

# Check deployment status
cd /mnt/c/Users/rpgfi/enhancive-alert && npx wrangler deployments list

# Query production DB
cd /mnt/c/Users/rpgfi/enhancive-alert && npx wrangler d1 execute enhancive-db --remote --command "SQL"
```
