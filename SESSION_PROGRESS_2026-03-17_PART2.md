# Session Progress 2026-03-17 Part 2

## What We Built This Session

### R2 Enriched Item Cache
- Created R2 bucket `enhancive-items` bound as `ITEMS_BUCKET`
- Built `src/enrichment.ts` — pre-computes per item:
  - Swap group totals (e.g. MC: 14, Lores: 7)
  - True costs (nugget/wearable_perm/wearable_nonperm)
  - Swap costs per target ability per group (Sylinara 10M/swap)
  - Normalized ability names, slot classification
- Scraper now writes `items_enriched.json` to R2 after every D1 update
- 5,689 items, 3.66MB blob, sub-millisecond to parse in Worker
- Debug route: `/api/debug/enriched`

### Recommendation Engine (TypeScript)
- Built `src/recommender.ts` — greedy algorithm translated from Python simulation
- Proportional gap-fill scoring: `score / log10(true_cost)^alpha`
- Dual-goal allocation: when multiple goals share a group (e.g. Religion + Blessings both in Lores), points are split proportionally, not double-counted
- Swap costs counted once per group, not per goal
- API route: `/api/recommend/:setId?alpha=1.5`
- Writes results to R2 as `recommendations/{setId}.json`

### Mejora Test Case Results (3 goals: Spirit MC gap=40, Religion gap=50, Blessings gap=50)
| Alpha | Items | Cost | Fill |
|-------|-------|------|------|
| 1.0 | 10 | 474M | 100% |
| 1.5 | 11 | 394M | 100% |
| 2.0 | 12 | 359M | 100% |

Duration: 0ms (sub-millisecond) for single set.

### Bug Fixes
1. **Skill rank regex bug** — `/s+ranks$/i` in template literal should have been `/ Ranks$/i`. The `\s` was eaten by the template literal, so the regex never matched, skill name lookups always failed, and advanced calc always assumed 0 current ranks (inflating values). Fixed in all 3 calc functions.
2. **Simplified Total Sum column** — Removed advanced skill calc complexity. Total Sum is now plain sum of all boost values. Useless skills subtract from that. Same number for every user viewing the same item.
3. **Hidden advanced skill calc checkbox** — Still functional but hidden from UI.

## Architecture Decision (Committed)
- `ARCHITECTURE_DECISION.md` — Full write budget analysis, free tier comparison, hybrid D1+R2 decision
- D1: user data (characters, goals, inventory, alerts, scrape_log) — ~5K writes/day
- R2: enriched items + recommendation results — ~720K writes/month (within 1M free)
- One Worker handles everything (no GitHub Action needed)

## Commits This Session (Part 2)
- `14e57ad` — Architecture decision doc
- `413fe88` — R2 enriched item cache: bucket binding, enrichment module, debug route
- `2f0dcc6` — Recommendation engine: greedy algorithm + API route
- `f2bd7db` — Fix dual-goal allocation: split shared group points, correct swap costs
- `46a0a3d` — Fix skill rank name regex
- `56a9b64` — Simplify Total Sum: plain boost sum minus useless skills
- `6943cfc` — Hide advanced skill calc checkbox

## What's Still Hardcoded (Mejora-only, needs generalization)
1. **Goal abilities** — hardcoded 3 goals for set_id=4 in the `/api/recommend` route
2. **Available slots** — hardcoded 14 for set_id=4
3. **Slot classification** — no dynamic open/locked/free-replacement calculation
4. **Goals schema** — current `set_goals.stat` stores fuzzy search terms ("wisdom", "lore", "mana control"), not exact ability names the engine needs

## What We Were Doing Before the Bug Fix Detour

We had just finished deploying and testing the recommendation engine with the Mejora test case across all 3 alphas. The next steps we identified were:

1. **Generalize goals** — Either update the goals UI/schema to use exact ability names, or build a mapping layer. We decided phase 1 would hardcode goals and assume target = cap (40 for stats, 50 for skills). The engine does `IFNULL(target, cap)`.

2. **Dynamic slot calculation** — Count available slots from account_type limits minus locked inventory items, identify free replacements (items where replacement value > current value).

3. **Inventory replacement evaluation** — The greedy loop should consider replacing existing low-value items in occupied slots if a shop item provides more value.

4. **Bloodstone family exclusion** — User already owns one bloodstone item; only one can be active. Exclude bloodstone family items from recommendations.

5. **Yakushi shop exclusion** — Already in the engine's EXCLUDED_SHOPS set.

6. **Build recommendation UI** — Display shopping list with alpha slider, cost breakdown, swap instructions.
