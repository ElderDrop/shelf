---
project: shelf
researched_at: 2026-06-07
recommended_platform: Cloudflare Workers
runner_up: Fly.io
context_type: mvp
tech_stack:
  language: TypeScript / JavaScript
  framework: Astro 6 SSR + React 19 (@astrojs/cloudflare 13)
  runtime: Cloudflare Workers (workerd) + Supabase (external)
---

## Recommendation

**Deploy on Cloudflare Workers** (not legacy Pages-only routing).

Shelf is already scaffolded with `@astrojs/cloudflare` and `wrangler.jsonc` pointing at `@astrojs/cloudflare/entrypoints/server`. The PRD targets small scale and cost-sensitive MVP work; Workers free tier covers low-traffic SSR, and admin metadata jobs can run on **Cloudflare Queues** consumers once the account is on **Workers Paid** ($5/month minimum — Queues are unavailable on the free plan, verified 2026-06). External Supabase stays as-is (interview Q5). Single-region is acceptable (Q4). Vercel and Netlify were dropped because interview Q1 requires background-capable work beyond pure request/response serverless.

## Platform Comparison

Hard filter applied: **Q1 = Yes** → excluded Vercel and Netlify (no persistent processes / long-lived workers for admin scraping pipeline).

| Platform | CLI-first | Managed/Serverless | Agent-readable docs | Stable deploy API | MCP / Integration | Total |
|---|---|---|---|---|---|---|
| **Cloudflare Workers** | Pass | Pass | Pass | Pass | Pass | 5P |
| Fly.io | Pass | Pass | Pass | Pass | Partial | 4P + 1Part |
| Railway | Pass | Pass | Partial | Pass | Partial | 3P + 2Part |
| Render | Partial | Pass | Partial | Pass | Fail | 2P + 2Part + 1F |
| Vercel | — | — | — | — | — | **Filtered out** (Q1) |
| Netlify | — | — | — | — | — | **Filtered out** (Q1) |

**Weighting from interview:** minimize cost (Q2) favors Cloudflare free SSR + optional $5 paid tier over Render’s ~$7/service or dual-service setups; no platform familiarity (Q3) — no tie-break; single region (Q4) — edge is nice-to-have, not required; external Supabase (Q5) — all shortlisted platforms OK.

### Shortlisted Platforms

#### 1. Cloudflare Workers (Recommended)

Native fit for the pinned stack (`astro build && npx wrangler deploy`). `npm run dev` already uses workerd locally (@package.json, @astro.config.mjs). Admin metadata enrichment (FR-005) maps to **Queues + consumer Worker** or **Cron Triggers** on the paid plan; scraping stays off the hot request path. Official Cloudflare MCP (`https://mcp.cloudflare.com/mcp`) and `llms.txt` docs support agent-driven ops. Estimated MVP cost: **$0** on free tier for SSR-only validation; **~$5/month** once Queues or sustained paid Workers usage is enabled.

#### 2. Fly.io

Strongest alternative if admin scraping routinely exceeds Worker CPU/time limits (15-minute max on Queue consumers) or needs always-on processes with `auto_stop_machines = false`. Fly Machines + `fly deploy` support Astro SSR via Node adapter — **requires replacing `@astrojs/cloudflare`**. Autostop keeps idle cost low (~few USD/month for a small Machine). Better for Q1 “always-on” semantics, worse for “already on Cloudflare” and migration cost.

#### 3. Railway

Hobby plan ($5/month + usage) can run a web service plus a background worker for scraping. Railway CLI and Git deploy are straightforward, but Astro today uses the Cloudflare adapter; migration is non-trivial. Middle ground on DX vs. cost; no edge-native SSR story like Workers.

## Anti-Bias Cross-Check: Cloudflare Workers

### Devil's Advocate — Weaknesses

1. **Queues cost gate** — Background jobs for FR-005 require Workers Paid ($5/month minimum); free tier cannot create Queues (Cloudflare API error code 100129; status checked 2026-06).
2. **CPU ceilings on scraping** — Default 30s CPU per invocation (configurable up to 5 min; Queue consumers up to 15 min). Heavy or brittle scrapers may timeout unless chunked or moved off Workers.
3. **Edge + Supabase split** — Auth/data on Supabase, compute on Workers: RLS, cookie sessions, and env secrets must stay aligned across two vendors; misconfiguration shows up as subtle auth bugs.
4. **Docs vs. repo drift** — `tech-stack.md` lists `cloudflare-pages`; the scaffold already targets **Workers** per `@astrojs/cloudflare@13` — newcomers may follow the wrong deploy guide.
5. **Paid-plan surprise** — “Minimize cost” (Q2) conflicts with Queues requirement; real MVP with admin automation is not $0 forever.

### Pre-Mortem — How This Could Fail

The team shipped Shelf on Cloudflare Workers with Supabase and queued admin scraping on Queues. They assumed the free tier would carry them through MVP. On first bulk catalog import, Queues were unavailable until they upgraded to Workers Paid — an unbudgeted $5/month and a week lost reworking job enqueue logic. Scraping targets with large HTML pages hit CPU limits; jobs retried until the queue poisoned. RLS policies were added late, so the admin preview path leaked draft catalog rows through a mis-scoped service role key in a Worker route. GitHub Actions built successfully but production secrets lived only in GitHub, not Wrangler secrets, so preview worked and production 500’d on auth. Six months in, they considered migrating scraping to Fly.io but the Astro Cloudflare adapter and Wrangler bindings made extraction expensive — they were stuck patching instead of replatforming.

### Unknown Unknowns

- **`@astrojs/cloudflare@13` defaults to Workers**, not Pages; `astro preview` now runs workerd — local behavior matches production, but old Pages tutorials mislead.
- **Wrangler config is optional** for basic deploys, but Queues/KV bindings still need explicit `wrangler.jsonc` entries.
- **Queue message retention** defaults to 4 days on paid plan — failed scrape jobs disappear unless you log outcomes to Supabase.
- **Workers Builds vs. GitHub Actions** — two CI paths; this repo uses GitHub Actions (@.github/workflows/ci.yml); production deploy secrets must exist in **both** GitHub (build) and **Wrangler/dashboard** (runtime).
- **Supabase service role vs. anon key** — admin automation must never use the anon key in a Queue consumer; easy foot-gun when copying auth patterns from SSR pages.

## Operational Story

- **Preview deploys**: GitHub PR → GitHub Actions runs lint/build (@.github/workflows/ci.yml). Connect repo to **Workers Builds** or add a deploy workflow with `npx wrangler deploy` on merge; each PR can get a preview URL via Wrangler preview / Workers preview aliases. Protect preview URLs with **Cloudflare Access** if share links must not be public.
- **Secrets**: Runtime — Cloudflare dashboard **Workers Secrets** or `wrangler secret put SUPABASE_URL` / `SUPABASE_KEY`. CI build — GitHub repository secrets (already required for build step). Local — `.dev.vars` (gitignored) per @README.md. Rotation: update Wrangler secrets + GitHub secrets together; redeploy Worker.
- **Rollback**: `wrangler rollback` (or Cloudflare dashboard → Worker → Deployments → Rollback) to prior version; typically minutes. **Does not** roll back Supabase migrations — apply migrations separately via `supabase db push` / migration files in `supabase/migrations/`.
- **Approval**: Human should approve production deploy, Wrangler secret changes, and Supabase migration apply. Agent may run read-only `wrangler tail`, `npm run lint`, and preview builds locally.
- **Logs**: `wrangler tail` for live Worker logs; Cloudflare dashboard → Workers → Observability (enabled in @wrangler.jsonc). GitHub Actions logs for CI. Optional: Cloudflare MCP for API operations (`https://mcp.cloudflare.com/mcp`).

## Risk Register

| Risk | Source | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| Queues require paid plan ($5/mo) | Devil's advocate / Research | H | M | Budget Workers Paid before FR-005; prototype enqueue on paid account early |
| Scrape jobs hit CPU/time limits | Devil's advocate | M | H | Chunk work; store partial results in Supabase; fallback Fly worker only if limits bite |
| Supabase RLS misconfiguration | Pre-mortem | M | H | Enable RLS on every new table; admin paths use server-only secrets; test draft/unapproved rows |
| Pages vs Workers doc confusion | Unknown unknowns | M | M | Treat Workers as canonical; update `tech-stack.md` deployment_target when convenient |
| Secrets mismatch CI vs runtime | Pre-mortem | M | H | Checklist: GitHub secrets for build, Wrangler secrets for deploy, `.dev.vars` for local |
| Queue poison / silent job loss | Unknown unknowns | L | M | Persist job status in Supabase; log failures; alert on admin dashboard |

## Getting Started

1. **Local (already scaffolded):** `cp .env.example .dev.vars`, fill `SUPABASE_URL` and `SUPABASE_KEY`, run `npm run dev` — uses workerd via Astro 6 + `@astrojs/cloudflare` (not a separate legacy `wrangler dev`-only flow for day-to-day UI work).
2. **Cloudflare account:** `npx wrangler login`; verify project name in @wrangler.jsonc (`10x-astro-starter` — rename to `shelf` when ready).
3. **First deploy:** `npm run build && npx wrangler deploy` (matches @astro.config.mjs adapter 13 + current entrypoint).
4. **Production secrets:** `npx wrangler secret put SUPABASE_URL` and `npx wrangler secret put SUPABASE_KEY`.
5. **Admin background jobs (FR-005):** Upgrade to Workers Paid; add Queue producer/consumer bindings in `wrangler.jsonc`; enqueue scrape jobs from admin API — do not run long scrapes inline in SSR request handlers.

## Out of Scope

- Docker image configuration
- CI/CD pipeline setup beyond documenting existing GitHub Actions + Wrangler deploy path
- Production-scale architecture (multi-region HA, DR, enterprise SLA)
