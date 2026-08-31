# Testing Critical-Path Bootstrap — Plan Brief

> Full plan: `context/changes/testing-critical-path-bootstrap/plan.md`
> Frame brief: `context/changes/testing-critical-path-bootstrap/frame.md`

## What & Why

Prove that a **non-admin cannot observe pending/rejected catalog items on reachable surfaces**, with a durable automated signal — not “bootstrap runner + ship Risks #1 and #2 together.” Introduce Vitest, lock the user-path approved filter and a thin admin-API 403, wire CI, and document the patterns.

## Starting Point

No test runner or `*.test.*` files. User catalog uses `listApproved` (`.eq("status","approved")`); admin uses `listAll` behind middleware + `requireAdmin`. RLS SQL under `supabase/tests/` is comment-only. Frame already deferred assignment IDOR (#2).

## Desired End State

`npm test` is green locally and in CI. Dropping the approved filter from `listApproved` fails a unit test. Non-admin admin catalog `GET` returns 403 in a handler test. Agents can add similar tests via the cookbook and AGENTS.md.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| -------- | ------ | ---------------- | ------ |
| Problem scope | Pending visibility, not #1+#2 | Frame: #2 deferred; multi-surface symptom | Frame |
| App oracle | Assert `.eq("status","approved")` | Catches dropped filter without tautological row mocks | Plan |
| Admin surface | Extract shared `requireAdmin` + unit 403 | Node Vitest cannot import admin GET (astro:env); helper is the gate | Frame + Plan review |
| Runner | Standalone Node Vitest | Avoids Cloudflare adapter friction for service tests | Plan |
| CI | `npm test` in this change | Suite must not rot from day one | Plan |
| Docs | Cookbook §6 + AGENTS; no §2 rewrite | §2 frozen; note #2 deferred in §6.6 | Plan |

## Scope

**In scope:** Vitest bootstrap; `listApproved` unit oracle; shared `requireAdmin` extract + 403 unit test; CI `npm test`; cookbook/AGENTS.

**Out of scope:** Risk #2 IDOR; full admin authz Phase 2; runnable RLS CI; Playwright/workerd Vitest; test-plan §1–§2 rewrite; enrichment/share/recommendations; CLAUDE.md edits (no conflicting test-runner guidance).

## Architecture / Approach

Node Vitest → fake PostgREST chain into `listApproved` → shared `requireAdmin` unit test (no supabase import) → CI step → doc handoff.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| ----- | ---------------- | -------- |
| 1. Vitest bootstrap | Runner, scripts, alias, green `npm test` | Config fights Astro/CF if `getViteConfig` used |
| 2. Pending-visibility signals | `.eq` oracle + admin 403 | Over-mocking / wrong oracle |
| 3. CI + cookbook | `ci.yml` + agent docs | Docs drift from files |

**Prerequisites:** Node 22; no Docker required for these tests.
**Estimated effort:** ~1–2 sessions across 3 phases.

## Open Risks & Assumptions

- Shared `requireAdmin` extraction is mandatory for Node Vitest (astro:env on route import).
- Pulling CI into this change overlaps test-plan Phase 5; accepted deliberately for a Node-only suite.
- §3 Phase 1 row still lists Risk #2 until a future `--refresh`.

## Success Criteria (Summary)

- `npm test` fails if `listApproved` loses the approved filter
- Non-admin cannot pass shared `requireAdmin` in tests
- CI and AGENTS/cookbook describe the same workflow
