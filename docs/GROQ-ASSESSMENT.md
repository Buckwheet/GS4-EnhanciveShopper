# Groq Free-Tier Assessment for GS4-EnhanciveShopper

**Purpose:** Evaluate whether offloading a computation from the Cloudflare Workers / D1 app
to Groq is worthwhile, given the current free-tier limits.

**Date researched:** 2026-08-26. Sources: Groq public docs (`/docs/quickstart`,
`/docs/rate-limits`, `/docs/models`). Limits can change — always check
https://console.groq.com/settings/limits for your organization.

## Quick verdict
**Do NOT integrate Groq for the idea suggested (compare new/removed item JSONs to do minimal
writes).** That is deterministic *data logic* already handled in-code by the write-guard (and
extended in Task 3 of the 2026-08-26 plan). An LLM is slower, non-deterministic, and eats the
tiny free-tier token budget for no benefit.

Groq is only arguably worth it for an **occasional, small-output, batched** job — e.g. a daily
price/trend summary — where the token cost is < the daily cap. Even that is marginal on free.

## API basics
- Base URL: `https://api.groq.com/openai/v1` (OpenAI-compatible).
- Auth: `Authorization: Bearer $GROQ_API_KEY`.
- Endpoints: `/chat/completions` or `/responses`.
- Example:
  ```
  curl -X POST https://api.groq.com/openai/v1/chat/completions \
    -H "Authorization: Bearer $GROQ_API_KEY" -H "Content-Type: application/json" \
    -d '{"model":"qwen/qwen3.8-27b","messages":[{"role":"user","content":"Hello"}]}'
  ```

## Free-tier rate limits (base; per organization)
| Model ID | RPM | RPD | TPM | TPD | Context | Max-out |
|---|---|---|---|---|---|---|
| `openai/gpt-oss-20b` | 30 | 1K | 8K | 200K | 131,072 | 65,536 |
| `openai/gpt-oss-120b` | 30 | 1K | 8K | 200K | 131,072 | 65,536 |
| `qwen/qwen3.8-27b` | 30 | 1K | 8K | **2M** | 131,072 | — |
| `groq/compound` | 30 | 250 | 70K | — | 131,072 | 8,192 |
| `groq/compound-mini` | 30 | 250 | 70K | — | 131,072 | 8,192 |

Key tension for this app:
- There are ~7,000 live items in `shop_items`.
- Per-item LLM labeling/extraction would be 7,000 requests — **way** over the 30 RPM / 1K RPD / 200K-2M TPD budget in minutes.
- The 70K-TPM "compound" systems are agentic/tool-use products (web search, code execution), overkill and not appropriate for deterministic diff/summary logic.
- `qwen/qwen3.8-27b`'s 2M TPD is the most generous free tier, but still only covers a few substantial batched calls a day, not thousands.

## What would (and wouldn't) be a good fit
GOOD (occasional, batched, small output):
- A **daily** email/Discord summary: "top movers, notable price drops, item count."
- A single, well-scripted prompt over a small slice of data (< ~200 items of text), run off-peak.
- Natural-language responses where a template/rule approach is awkward.

NOT GOOD:
- Per-item or per-request real-time calls (D1/endpoint hot path).
- The "compare item JSONs to reduce writes" idea — deterministic diff, already in code.
- Anything needing deterministic, reproducible, low-latency output.

## Recommended path
- **Do not** add a Groq dependency or a `GROQ_API_KEY` to `.env` now.
- Keep this document as the reference. If a concrete light use case is later approved, open a new
  plan (integration = add `GROQ_API_KEY` to `.env` + a Workers secret, a small helper, and a
  scheduled task), and pick `qwen/qwen3.8-27b` as the default free-tier model (highest TPD).
