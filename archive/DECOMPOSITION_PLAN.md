# AI Implementation Plan: GS4 Enhancive Shopper Decomposition

## Context
Convert the current monolith into a high-performance, cost-free distributed system. Use this as the primary execution guide. Refer to `PLANNING.md` for business logic and stat/goal definitions.

## Target Architecture
- **Storage**: D1 (Source of Truth), R2 (Recommendation Cache).
- **Service A (Scraper)**: Triggers hourly via Cron -> Updates D1 -> Dispatches GitHub Action.
- **Service B (API/UI)**: Hono Worker. Handles Auth/CRUD. Reads Recommendations from R2.
- **Service C (Optimizer)**: GitHub Action. Pulls data from Service B -> Computes MDKP -> Pushes results to Service B.

## Phase 1: Infrastructure Setup
- [ ] Create R2 Bucket: `gs4-enhancive-data`.
- [ ] Generate GitHub Personal Access Token (PAT) with `workflow` scope.
- [ ] Set Cloudflare Secret: `GH_PAT`.
- [ ] Set Cloudflare/GH shared secret: `INTERNAL_AUTH_KEY`.

## Phase 2: Refactor Scraper (Service A)
- [ ] Create `gs4-scraper` Worker (extract from `src/index.ts` and `src/scraper.ts`).
- [ ] Implementation: After `D1` update, trigger GitHub Dispatch:
  ```typescript
  fetch('https://api.github.com/repos/{owner}/{repo}/dispatches', {
    method: 'POST',
    headers: { Authorization: `Bearer ${GH_PAT}`, 'User-Agent': 'CF-Worker' },
    body: JSON.stringify({ event_type: 'run_optimizer' })
  })
  ```

## Phase 3: The Brain (Service C - GitHub Action)
- [ ] Create `.github/workflows/optimizer.yml` (Trigger: `repository_dispatch`).
- [ ] Implement `scripts/solve_mdkp.ts`:
  - Fetch snapshot from `/api/internal/snapshot` (Protected by `INTERNAL_AUTH_KEY`).
  - Logic: Greedy + Combinatorial search (Swatch, Nugget, Swap, Syllinar).
  - Output: POST results to `/api/internal/store-results`.

## Phase 4: API Refactor (Service B)
- [ ] **Snaphot Endpoint**: `GET /api/internal/snapshot` -> returns all available items + user criteria.
- [ ] **Store Endpoint**: `POST /api/internal/store-results` -> Receives JSON -> `env.BUCKET.put()`.
- [ ] **Recommendation Read**: Update `GET /api/recommendations` to `env.BUCKET.get()`.
- [ ] Remove `recommendation-engine.ts` from the API worker to save bundle size/CPU.

## Security Requirements
- Ensure `/api/internal/*` checks for `header['X-Internal-Secret'] === INTERNAL_AUTH_KEY`.
- No sensitive keys in public YAML files.
