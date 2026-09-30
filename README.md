# GS4 Enhancive Shopper

Cloudflare Worker that scrapes GemStone IV player shops (https://shops.elanthia.online) hourly, recommends enhancive purchases against each character's goals and inventory, and sends Discord DM alerts.

**Live:** https://gs4-enhancive-shopper.rpgfilms.workers.dev

Stack: Hono · D1 · R2 · Workers AI · Discord OAuth/Bot · TypeScript · Biome

## Develop

```bash
npm install
npm run dev
npm run typecheck && npm run lint
```

Work on a branch, open a PR against `main` (CI runs typecheck + lint), merge → CI deploys.

## Docs

- [AI_INSTRUCTIONS.md](AI_INSTRUCTIONS.md) — architecture, schema, routes, conventions
- [docs/DecisionBrain.md](docs/DecisionBrain.md) — recommendation engine spec
- [ROADMAP.md](ROADMAP.md) — shipped features; open work lives in [Issues](https://github.com/Buckwheet/GS4-EnhanciveShopper/issues)
- `archive/` — historical session notes, prototypes, and data dumps (not used at runtime)
- `enh_export.lic` — Lich export script; served by the app from `main`, keep at repo root
