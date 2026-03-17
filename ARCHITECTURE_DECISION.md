# Architecture Decision: R2 Enriched Item Cache

## Problem

D1 free tier allows 100K row writes/day. Current scraper alone uses ~5,500 writes/scrape × 24 scrapes/day = 132K writes/day — already over the limit. At scale (300 users × 3 characters ≈ 1,000 sets), adding recommendation result writes pushes to 162K-473K writes/day depending on storage granularity.

### Write Budget at Scale (1,000 sets)

| Component | Writes/scrape | Writes/day (×24) |
|-----------|--------------|-------------------|
| Shop item updates (last_seen) | 5,500 | 132,000 |
| Recommendation results (1 row/set) | 1,000 | 24,000 |
| Recommendation results (per-item) | 10,000-14,000 | 240,000-336,000 |
| Alert matches | 50-200 | 1,200-4,800 |
| Metadata + scrape_log | 2 | 48 |

**D1 limit: 100,000 writes/day. Every scenario exceeds this.**

## Free Tier Comparison

| Service | Write Limit | Read Limit | Storage | Fits? |
|---------|------------|------------|---------|-------|
| Cloudflare D1 | 100K rows/day | 5M rows/day | 5 GB | ❌ Already over |
| Turso (libSQL) | 10M rows/month | 500M rows/month | 5 GB | ⚠️ Tight at scale |
| Neon (PostgreSQL) | No row limit (100 CU-hrs) | No row limit | 0.5 GB/project | ⚠️ Storage tight |
| Supabase (PostgreSQL) | No row limit | No row limit | 500 MB | ⚠️ Pauses after 1wk idle |
| DynamoDB | 25 WCU (~2.1M/day) | 25 RCU | 25 GB | ⚠️ Slow batch throughput |
| Cloudflare R2 | 1M Class A ops/month | 10M Class B ops/month | 10 GB | ✅ Plenty of room |

## Decision: Hybrid D1 + R2

### What stays in D1 (low-write relational data)
- Characters, goals, inventory (user edits only — rare writes)
- Alert history (50-200 writes/scrape)
- Scrape log, metadata (2 writes/scrape)
- **Total D1 writes/day: ~5,000 — well within 100K**

### What moves to R2 (high-write bulk data)
- **`items_enriched.json`** — All ~5,700 shop items, pre-computed with swap group totals, true costs, swap costs per target ability. One blob, ~5-8MB. Written once per scrape.
- **`recommendations/{set_id}.json`** — One blob per set with the full shopping list. Written once per scrape cycle.
- **R2 writes/month: (1 + 1,000) × 24 × 30 = ~720K — within 1M Class A limit**
- **R2 reads/month: page loads + recommendation views — well within 10M Class B limit**

## Enriched Item Schema

Each item in `items_enriched.json` is pre-computed by the scraper so downstream consumers do zero parsing/normalization:

```json
{
  "id": 12345,
  "name": "a scorched faewood runestaff",
  "town": "Wehnimer's Landing",
  "shop": "Bare Hands",
  "cost": 6500000,
  "slot": "nugget",
  "is_permanent": true,
  "true_costs": {
    "nugget": 31500000,
    "wearable_perm": 6500000,
    "wearable_nonperm": 16500000
  },
  "group_totals": {
    "Weapons": 7,
    "Recovery": 4,
    "MC": 14
  },
  "abilities": [
    {"name": "Spell Aiming", "group": "Weapons", "boost": 7},
    {"name": "Mana Recovery", "group": "Recovery", "boost": 4},
    {"name": "Spirit Mana Control", "group": "MC", "boost": 10},
    {"name": "Elemental Mana Control", "group": "MC", "boost": 4}
  ],
  "swap_costs": {
    "MC": {
      "Spirit Mana Control": 10000000,
      "Elemental Mana Control": 20000000,
      "Mental Mana Control": 20000000
    },
    "Weapons": {
      "Spell Aiming": 0,
      "Edged Weapons": 10000000
    },
    "Recovery": {
      "Mana Recovery": 0,
      "Stamina Recovery": 10000000
    }
  },
  "total_score": 25,
  "num_groups_hit": 3,
  "available": true,
  "last_seen": "2026-03-17T10:00:00Z"
}
```

### What `swap_costs` means
For each group the item contributes to, we pre-calculate the sylinara swap cost for every possible target ability in that group. Example: this item has +10 SMC and +4 EMC (14 total MC). If the user's target is Spirit MC, only the EMC needs swapping = 10M. If the target is Elemental MC, only the SMC needs swapping = 10M. If the target is Mental MC, both need swapping = 20M.

### What `true_costs` means
Pre-calculated for each slot scenario:
- `nugget`: item cost + 25M (includes permanence)
- `wearable_perm`: item cost (already permanent, equip directly)
- `wearable_nonperm`: item cost + 10M pell

The recommendation engine picks the appropriate true_cost based on the item's actual slot classification for the user's character.

## Recommendation Engine Flow (Post-Architecture)

1. Scraper runs hourly → scrapes items → writes `items_enriched.json` to R2
2. After enriched blob is written, engine loops through all sets:
   - Read set's goals + inventory from D1
   - Read `items_enriched.json` from R2 (cached in memory for the batch)
   - Run greedy algorithm using pre-computed group_totals and true_costs
   - Write `recommendations/{set_id}.json` to R2
3. User loads recommendation page → Worker reads from R2 → returns results

## Revert Strategy

- D1 `shop_items` table stays intact. Scraper continues writing to D1 in parallel during transition.
- R2 is purely additive — one binding in `wrangler.toml`, one `env.BUCKET.put()` call.
- To revert: change recommendation engine to read from D1 instead of R2. One code path change.
- No schema migrations, no data loss risk.

## Decomposition Plan Status

The original `DECOMPOSITION_PLAN.md` proposed 3 services:
- Service A (Scraper) — separate worker
- Service B (API/UI) — Hono worker
- Service C (Optimizer) — GitHub Action

### What changes:
- **Service C (GitHub Action) is unnecessary.** Algorithm benchmarks show 1,000 sets complete in ~27s (Python) / ~10-15s estimated (TS). Fits within a single Worker invocation.
- **Service A (separate scraper) is optional.** The scraper can stay in the main worker triggered by cron. Separation only needed if the scrape + enrichment + recommendation batch exceeds Worker CPU limits.
- **R2 replaces the need for a separate optimizer service.** Pre-computation happens in the scraper. Recommendations are computed in the same worker. Results cached in R2.

### Revised architecture:
- **One Worker** (Hono) — handles UI, API, cron-triggered scrape, enrichment, recommendation batch
- **D1** — user data (characters, goals, inventory, alerts, scrape_log)
- **R2** — enriched item cache, recommendation results

## Sylinara Swap Cost

- 10,000 soul shards = 10M silver per swap, flat fee regardless of boost value
- Each enhancive on an item that doesn't match the target ability costs one swap
- Pre-calculated per target ability in the enriched item schema

## Algorithm (Unchanged)

```
score = sum(min(contribution[g], gap[g]) / gap[g] for each goal g)
true_cost = item.true_costs[slot_type] + item.swap_costs[group][target_ability]
value = score / log10(true_cost)^alpha
```

Alpha settings: 1.0 (cash flush), 1.5 (balanced/default), 2.0 (cash adverse)
