<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Catalog Schema and RLS Implementation Plan

- **Plan**: context/changes/catalog-schema-rls/plan.md
- **Scope**: Phases 1–3 of 3
- **Date**: 2026-08-17
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 4 warnings, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | WARNING |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — Domain tables have no Data API GRANTs

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20260608120000_catalog_schema.sql:113
- **Detail**: RLS is enabled and `is_admin()` is granted, but there are no `GRANT`s on `profiles`, `catalog_items`, or `user_assignments`. With CLI 2.113 and `auto_expose_new_tables` unset (fail-closed), `supabase-js` (anon key) can get permission denied before RLS runs. Studio as `postgres` would still succeed.
- **Fix A ⭐ Recommended**: Add least-privilege GRANTs for `authenticated` (no `anon`) in a follow-up migration before S-01 queries these tables.
  - Strength: Unblocks S-01 without widening anonymous access.
  - Tradeoff: Another migration; must match policy verbs (profiles SELECT/UPDATE, catalog admin DML, assignments CRUD).
  - Confidence: HIGH — matches current Supabase default.
  - Blind spot: Local Studio checks as postgres would not have caught this.
- **Fix B**: Set `auto_expose_new_tables = true` in config.toml (legacy).
  - Strength: One-line local/cloud config.
  - Tradeoff: Deprecated; broader default exposure than explicit GRANTs.
  - Confidence: MEDIUM — field is going away.
  - Blind spot: Hosted project may already differ from local config.
- **Decision**: FIXED via Fix A

### F2 — RLS helper cannot impersonate users as written

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: supabase/tests/rls_catalog.sql:1
- **Detail**: The file header suggests `npx supabase db query --file …`, but every statement is commented (no-op). Impersonation uses `SET LOCAL request.jwt.claim.sub`; current `auth.uid()` reads `request.jwt.claims` JSON. A null uid fail-closes and can look like “RLS works.” Manual Phase 2 checks still passed via real sessions.
- **Fix**: Document as copy-paste only, and use `set_config('request.jwt.claims', json_build_object('sub', uuid, 'role', 'authenticated')::text, true)` plus `SET LOCAL ROLE authenticated`.
- **Decision**: FIXED

### F3 — Dev server binds 0.0.0.0 and disables Host checks

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: astro.config.mjs:15
- **Detail**: Unplanned Phase 2 extra: `vite.server.allowedHosts: true` plus `astro dev --host 0.0.0.0`. Needed for the container, but it turns off DNS-rebinding protection on a published port.
- **Fix**: Replace `allowedHosts: true` with an explicit list (`localhost`, `127.0.0.1`, `host.docker.internal`) and keep the 0.0.0.0 bind.
- **Decision**: FIXED

### F4 — Local-dev extras landed in schema commits

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: .devcontainer/devcontainer.json:1
- **Detail**: Phase 2/3 commits also include `.devcontainer/*`, `package.json` host bind, `astro.config.mjs`, and `.gitignore` entries. Necessary to reach host Supabase from the container, but not in the plan’s Changes Required. Product “NOT Doing” list (admin UI, APIs, service role) was respected.
- **Fix**: Leave as-is; treat as documented local-dev addendum rather than reverting.
- **Decision**: FIXED

### F5 — `profiles.role` lock is policy-only and untested in the SQL helper

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20260608130000_catalog_rls.sql:12
- **Detail**: Self-update WITH CHECK compares `role` to the current row (plan-aligned). There is no column REVOKE or BEFORE UPDATE trigger, and the helper never asserts that `SET role = 'admin'` fails.
- **Fix**: Add a trigger (or REVOKE UPDATE(role)) plus one helper snippet for self-promotion denial.
- **Decision**: FIXED

### F6 — README still runs `supabase init` on an existing project

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: README.md:87
- **Detail**: Phase 3 correctly replaced the “no migrations” line, but first-time setup still tells people to `npx supabase init`, which can overwrite `config.toml` / `project_id`.
- **Fix**: Drop the init step; start from `npx supabase start` then `npx supabase db reset`.
- **Decision**: FIXED

### F7 — SECURITY DEFINER search_path includes `public` only

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20260608120000_catalog_schema.sql:70
- **Detail**: `handle_new_user` and `is_admin` set `search_path = public`. Bodies already qualify `public.profiles`. `pg_temp` can still precede `public` if omitted from an empty-first path.
- **Fix**: `SET search_path = ''` (or `pg_catalog, public, pg_temp`) on the two definer functions.
- **Decision**: FIXED
