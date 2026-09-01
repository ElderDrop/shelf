# Testing Critical-Path Bootstrap Implementation Plan

## Overview

Introduce Vitest and the first automated signals that a **non-admin cannot observe pending/rejected catalog items** on reachable surfaces: the user catalog path (`listApproved` always filters `status = approved`) and the admin API gate (`requireAdmin` → 403 before `listAll`). Wire `npm test` into CI and document patterns in the test-plan cookbook and AGENTS.md.

Authoritative problem statement (from frame): prove non-admin pending invisibility with a durable automated signal — not “runner + Risk #1 + Risk #2.”

## Current State Analysis

- No test runner, no `*.test.*` files, CI is lint + build only (`package.json`, `.github/workflows/ci.yml`).
- User `/catalog` calls `listApproved`, which applies `.eq("status", "approved")` (`src/lib/services/catalog.ts:84-90`, `src/pages/catalog.astro:20`). UI does not re-filter status.
- Admin lists use `listAll` (no default status filter). Non-admins are blocked by middleware and by route-local `requireAdmin` (`src/pages/api/admin/catalog.ts:10-15,33-35`).
- `supabase/tests/rls_catalog.sql` is comment-only Studio paste — not CI-runnable; RLS automation is out of this change.
- Frame (HIGH confidence): defer Risk #2 (assignment IDOR); optional thin admin-read denial is in scope; multi-surface *symptom* without full Phase 2 Risk #3 work.

### Key Discoveries:

- `listApproved` / `listAll` take an injectable `SupabaseClient` — chainable PostgREST builder is easy to fake under Node Vitest (`src/lib/services/catalog.ts:84-125`).
- Admin `GET` calls `requireAdmin` **before** `createClient` / `listAll` at runtime (`src/pages/api/admin/catalog.ts:33-39`), but importing the route under Node Vitest still evaluates `astro:env/server` via `@/lib/supabase` — extract `requireAdmin` for a Node-safe unit test.
- Standalone `vitest.config.ts` (Node) preferred over Astro `getViteConfig` to avoid Cloudflare adapter friction for service/API unit tests.
- AGENTS.md currently forbids adding a runner unless the active change introduces one — this change is that introduction.

## Desired End State

After this plan completes:

1. `vitest` is a project dependency; `npm test` / `npm run test:watch` run Node-side tests with `@/*` alias resolution.
2. A unit test proves `listApproved` always issues `.eq("status", "approved")` for empty and non-empty search queries (oracle = builder call, not mocked row contents).
3. A unit test proves shared `requireAdmin` returns HTTP 403 JSON for non-admin `profile.role` (admin catalog routes use that helper before `listAll`).
4. GitHub Actions runs `npm test` after lint on push/PR to `master`.
5. `context/foundation/test-plan.md` §6 cookbook entries for unit/integration/API patterns are filled for what this change shipped; AGENTS.md documents how to run tests; a note records Risk #2 deferred for this Phase 1 change (no §2 risk-map rewrite).

**Verification:** `npm test`, `npm run lint`, and `npm run build` pass; human confirms cookbook/AGENTS instructions match reality.

## What We're NOT Doing

- Risk #2 assignment mutate IDOR tests (deferred; not absorbed into test-plan Phase 2).
- Full Risk #3 / Phase 2 admin authz suite (middleware HTML 403, approve/reject mutations, role bootstrap).
- Runnable RLS/pgTAP CI from `rls_catalog.sql` (comment-only stays; optional later phase).
- Playwright/e2e, Astro container tests, Cloudflare workerd Vitest pool.
- Rewriting test-plan §1–§2; no `/10x-test-plan --refresh` in this change.
- Metadata enrichment, share links, recommendations fixtures (other rollout phases).

## Implementation Approach

Three phases: land the runner, then the two pending-visibility signals, then CI + documentation handoff.

**Admin gate (mandatory):** Do **not** import exported admin `GET` under Node Vitest as the primary path — the route module statically imports `@/lib/supabase`, which loads `astro:env/server` at module evaluation (`src/lib/supabase.ts`) and fails before `requireAdmin` can short-circuit. Extract a shared `requireAdmin` helper into `src/lib/` (no supabase / `astro:env` imports), wire both `src/pages/api/admin/catalog.ts` and `src/pages/api/admin/catalog/[id].ts` to it, and unit-test the helper (non-admin → 403 Response). Optional later: `vi.mock("@/lib/supabase")` + call `GET` if you want to lock call-order; out of scope unless cheap.

Test anti-patterns to avoid (from test-plan Risk #1/#3 guidance): asserting against a mocked approved-only `data` array as the sole oracle; happy-path admin-only checks; treating “no edit UI” as proof of denial.

## Phase 1: Vitest bootstrap

### Overview

Add Vitest (Node environment), path alias, scripts, and a minimal `@/`-import smoke test so the runner is proven before domain assertions.

### Changes Required:

#### 1. Dev dependency and scripts

**File**: `package.json`

**Intent**: Add `vitest` and scripts so agents/humans can run the suite locally the same way CI will.

**Contract**: `"test": "vitest run"`, `"test:watch": "vitest"`; `vitest` in `devDependencies` (version compatible with Vite 7 / project overrides).

#### 2. Vitest config

**File**: `vitest.config.ts` (repo root)

**Intent**: Standalone Node config that resolves `@/*` → `./src/*` without loading the Astro Cloudflare adapter.

**Contract**: `environment: "node"`; `include` matching `src/**/*.{test,spec}.ts`; `resolve.alias` for `@`. Do not use `getViteConfig` from `astro/config` in this phase.

#### 3. Alias-resolution smoke test

**File**: `src/lib/services/catalog.smoke.test.ts`

**Intent**: Prove Vitest resolves `@/*` and exits green before Phase 2 domain tests land.

**Contract**: Import from `@/lib/services/catalog` or `@/types` and assert a trivial truth (e.g. `CatalogServiceError` is defined). No query-builder mocks. Keep this file through Phase 2; domain assertions live in `catalog.test.ts`, not by deleting the smoke.

### Success Criteria:

#### Automated Verification:

- `npx vitest run` (or `npm test`) exits 0 with ≥1 passing test
- `npm run lint` passes on new config/scripts files
- `@/` imports resolve inside a test file that imports from `@/lib/services/catalog` or `@/types`

#### Manual Verification:

- `npm run test:watch` starts and re-runs on save (spot-check once)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Pending-visibility signals

### Overview

Automate the two cheap oracles agreed in planning: `listApproved` always applies the approved status filter, and non-admin admin-catalog `GET` returns 403.

### Changes Required:

#### 1. Query-builder test double

**File**: `src/lib/services/__tests__/supabase-query-mock.ts` (or colocated helper under `src/test/`)

**Intent**: Provide a chainable fake (`from` → `select` → `eq` → `order` → optional `or` → await `{ data, error }`) that records calls for assertions.

**Contract**: Tests can assert `eq` was invoked with `("status", "approved")`. Await resolves with empty `data` by default so mapping isn’t the oracle.

#### 2. `listApproved` unit tests

**File**: `src/lib/services/catalog.test.ts`

**Intent**: Lock the user-path app filter so dropping `.eq("status", "approved")` or failing to keep it when search `or(...)` is applied fails the suite.

**Contract**:
- Call `listApproved(fakeClient)` with no query → assert `.eq("status", "approved")` recorded.
- Call `listApproved(fakeClient, "manga")` → assert `.eq("status", "approved")` still recorded (and ideally `.or` was used); do **not** use “returned rows are approved” as the sole oracle when the mock invents rows.
- Do not assert `listAll` returns only approved (by design it may return pending).

#### 3. Shared `requireAdmin` + unit test

**Files**:
- `src/lib/require-admin.ts` (or similarly named under `src/lib/`)
- `src/lib/require-admin.test.ts`
- `src/pages/api/admin/catalog.ts`
- `src/pages/api/admin/catalog/[id].ts`

**Intent**: Prove a non-admin cannot pass the admin JSON API gate (pending-visible symptom on admin surface) without loading `astro:env` in Vitest.

**Contract**: Extract `requireAdmin(context | locals)` so it only reads `profile?.role`, returns `jsonError(403, "Forbidden")` (`{ "error": "Forbidden" }`) for non-admin, and returns `null` for admin. Both admin catalog API modules import and call it at the start of handlers (same call sites as today’s local helpers). Unit-test: non-admin → status 403 + body; admin → `null`. Do **not** make importing route `GET` the primary test strategy.

**Anti-pattern**: Only testing admin happy-path `200` with `listAll` mocked; importing admin routes without mocking supabase/`astro:env`.

### Success Criteria:

#### Automated Verification:

- `npm test` passes including `catalog.test.ts` (empty-query `listApproved` records `.eq("status", "approved")`)
- Search-path `listApproved(fakeClient, "manga")` still records `.eq("status", "approved")`
- Shared `requireAdmin` returns 403 for non-admin without Supabase / `astro:env`
- Both admin catalog API modules import the shared helper (no duplicated local `requireAdmin`)
- Dropping `.eq("status", "approved")` from `listApproved` (temporary local edit) causes the unit test to fail — implementer verifies once during development, then restores

#### Manual Verification:

- Skim test names/descriptions: a future agent can tell they protect “pending not visible to non-admin” without reading the frame

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: CI + cookbook handoff

### Overview

Lock the suite in CI and update agent-facing docs so the next test work follows the same patterns. Record that Risk #2 was deferred for this Phase 1 change without rewriting test-plan §2.

### Changes Required:

#### 1. CI workflow

**File**: `.github/workflows/ci.yml`

**Intent**: Fail PRs/pushes if the suite regresses.

**Contract**: After `npm run lint`, run `npm test` (Node-only; no Supabase secrets required for these tests). Keep existing `astro sync` and `build` steps.

#### 2. AGENTS.md testing section

**File**: `AGENTS.md`

**Intent**: Replace “no test runner” with how to run and where tests live.

**Contract**: Document `npm test` / `npm run test:watch`; note Vitest + `src/**/*.{test,spec}.ts`; note CI runs tests. Remove or rewrite the line that forbids adding a framework now that one exists. Optionally one line: prefer cheapest layer per `context/foundation/test-plan.md`.

#### 3. Test-plan cookbook + Phase 1 note

**File**: `context/foundation/test-plan.md`

**Intent**: Fill §6 placeholders for patterns this change shipped; note Risk #2 deferred without editing §2 risk rows.

**Contract**:
- §6.1 — unit test location/naming/`npm test` / reference `src/lib/services/catalog.test.ts` (pending-visibility / `.eq` oracle).
- §6.2 — TBD or brief note that integration/RLS automation not yet landed.
- §6.4 — API / authz gate pattern: unit-test shared `requireAdmin` with fake locals; reference `src/lib/require-admin.test.ts`.
- §6.5 — still TBD for runnable RLS (point at Phase 1 having left SQL comment-only).
- §6.6 — 2–3 lines: Phase 1 shipped Vitest + `listApproved` filter oracle + shared `requireAdmin` 403; **Risk #2 deferred by frame** (still listed on §3 Phase 1 row until `--refresh`).
- Bump “Last updated” and §8 freshness dates.
- §3 Phase 1 Status → `planned` or leave for orchestrator; if this plan is the artifact, set Status to `planned` and keep Change folder path (implement will move to `implementing`).

### Success Criteria:

#### Automated Verification:

- `npm test`, `npm run lint`, `npm run build` pass locally
- `ci.yml` contains a `npm test` step after lint
- Cookbook §6.1 and §6.4 no longer read only “TBD — see §3 Phase 1” for the shipped patterns

#### Manual Verification:

- Read AGENTS.md + test-plan §6: instructions match files on disk
- Confirm §2 risk map unchanged; §6.6 mentions Risk #2 deferred

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- `listApproved` filter oracle (empty + search query)
- Shared `requireAdmin` non-admin → 403

### Integration Tests:

- None in this change (no Docker Supabase / RLS automation)

### Manual Testing Steps:

1. Run `npm test` and confirm green output lists the new files
2. Optionally break `.eq` locally and confirm failure, then restore
3. Confirm CI YAML step order: sync → lint → test → build

## Performance Considerations

Node Vitest suite should stay sub-second for these tests; no Worker pool.

## Migration Notes

N/A — no schema changes. First introduction of Vitest may require `npm install` after pulling.

## References

- Frame brief: `context/changes/testing-critical-path-bootstrap/frame.md`
- Test plan: `context/foundation/test-plan.md` §2 Risks #1/#3, §3 Phase 1
- `src/lib/services/catalog.ts:84-125`
- `src/pages/api/admin/catalog.ts:10-35`
- `src/pages/catalog.astro:20`
- `supabase/tests/rls_catalog.sql` (manual only; not automated here)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Vitest bootstrap

#### Automated

- [x] 1.1 `npm test` exits 0 with ≥1 passing test — b2a534a
- [x] 1.2 `npm run lint` passes on new config/scripts files — b2a534a
- [x] 1.3 `@/` imports resolve inside a Vitest file — b2a534a

#### Manual

- [x] 1.4 `npm run test:watch` spot-check once — b2a534a

### Phase 2: Pending-visibility signals

#### Automated

- [x] 2.1 Empty-query `listApproved` records `.eq("status", "approved")` — f73d181
- [x] 2.2 Search-path `listApproved` still records `.eq("status", "approved")` — f73d181
- [x] 2.3 Shared `requireAdmin` returns 403 for non-admin without Supabase/`astro:env` — f73d181
- [x] 2.4 Both admin catalog API modules use the shared helper — f73d181
- [x] 2.5 Temporary drop of `.eq` fails the unit test (verified once, then restored) — f73d181

#### Manual

- [x] 2.6 Test names clearly describe pending-visibility protection — f73d181

### Phase 3: CI + cookbook handoff

#### Automated

- [x] 3.1 `ci.yml` runs `npm test` after lint
- [x] 3.2 `npm test`, `npm run lint`, and `npm run build` pass
- [x] 3.3 test-plan §6.1 and §6.4 document shipped patterns (not TBD-only)

#### Manual

- [x] 3.4 AGENTS.md matches how tests are run
- [x] 3.5 §6.6 notes Risk #2 deferred; §2 risk map untouched
