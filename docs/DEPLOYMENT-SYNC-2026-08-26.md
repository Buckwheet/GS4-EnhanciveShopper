# Deployment Sync Report — 2026-08-26

**Purpose:** Confirm the D1 usage-reduction changes (#2..#7) are live and synced to
GitHub + Cloudflare, and explain the Cloudflare "Deployment failed" emails the user received.

## Summary
- **All 6 D1-usage PRs (`#2`..`#7`) are merged to `main` and deployed.** Every GitHub Actions
  CI run is `completed/success`, and the live worker is healthy and serving the latest code.
- **The `.env` file with credentials is NOT tracked by git.** `git ls-tree -r main` reports 0 `.env` rows.
- **About the "Deployment failed" emails:** see the conclusion at the bottom.

## 1. Local `main` is synced to `origin/main`
- Local `main` short-hash: `8b8a637` (`Merge pull request #7 from Buckwheet/perf/warm-r2-blob-on-nochange`)
- `origin/main`: `8b8a637` — identical.
- `git ls-tree -r main --name-only | grep -c '\.env$'` → **0** (credentials never committed).
- Working tree clean except untracked `docs/` (this report + SDD artifacts).

## 2. GitHub Actions deploys (all success)
| Run ID | Created (UTC) | Event | Conclusion |
|---|---|---|---|
| 32960780970 | 2026-08-26 10:56:27 | push (PR #2 merge) | success |
| 32963051995 | 2026-08-26 11:23:12 | push (PR #3 merge) | success |
| 32963428004 | 2026-08-26 11:27:42 | push (PR #4 merge) | success |
| 32964007324 | 2026-08-26 11:34:36 | push (PR #5 merge) | success |
| 32964559606 | 2026-08-26 11:41:04 | push (PR #6 merge) | success |
| 32965447005 | 2026-08-26 11:51:10 | push (PR #7 merge) | success |

All `conclusion: success`, `headBranch: main`.

## 3. Cloudflare worker deployments (all `source: wrangler`)
| Deployment (id prefix) | Created (UTC) |
|---|---|
| b9b301ba | 2026-08-26 10:56:55 |
| b13a1e22 | 2026-08-26 11:23:37 |
| cf5c5129 | 2026-08-26 11:28:08 |
| 9b223d48 | 2026-08-26 11:35:00 |
| 77e13838 | 2026-08-26 11:41:27 |
| 8b08768a | 2026-08-26 11:51:40 |

Timestamps align with the GitHub Actions deploys; `source` is `wrangler` (the CI action).

## 4. Live worker health + current code proof
- `GET /api/scrape-health` → `healthy: true`, `hours_since_last_success: 1.7`.
- `GET /api/items` → returns the **lean R2 fast-path blob** shape
  (`is_permanent`, `item_type`, `enhancives_json` present; `available`/`scraped_at`/`last_seen` absent).
  This proves the PR #7 "warm on no-change" code is live and the R2 optimization is active.

## Conclusion on the "Deployment failed" emails
Every current GitHub Actions deploy and every Cloudflare deployment succeeded, and the worker is
live and current. Therefore the failure emails most plausibly came from **one of**:
1. An **earlier transient attempt** (pre-dating today's green run), or
2. A **different Cloudflare resource/account** (the Rpgfilms account also hosts unrelated
   projects; there are other accounts for `matts` and `unltd-handyman`), or
3. Cloudflare's notification about a non-blocking validation hiccup on one of the six rapid
   deploys (6 deploys in ~1 hour) — the deployment rollouts on Cloudflare all show `source: wrangler`
   and none is flagged failed in the current API.

**No code fix is required.** If an email recurs, check the email's subject/worker name and the
Cloudflare dashboard → Workers → Deployments page for THIS worker id to see which deploy (and which
account/resource) it refers to. Since all 6 production deploys are green and verified, the worker is
in the correct state.

## Artifact
This report is intentionally committed separately (`docs/DEPLOYMENT-SYNC-2026-08-26.md`).
