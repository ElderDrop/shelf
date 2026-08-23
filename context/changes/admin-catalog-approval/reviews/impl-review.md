<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Admin Catalog Creation and Approval

- **Plan**: context/changes/admin-catalog-approval/plan.md
- **Scope**: Phases 1–4 of 4
- **Date**: 2026-08-22
- **Verdict**: NEEDS ATTENTION → triaged (all findings FIXED)
- **Findings**: 0 critical 5 warnings 2 observations (7 FIXED)

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

## Grounding

- Commits: `a166171` … `803628c` + epilogue `f2d36d2`
- Automated: `npm run lint` PASS, `npm run build` PASS, migration present, `zod` in package.json
- Manual Progress: all `[x]` with SHAs; Phase 2 also exercised via authenticated curl in-session

## Findings

### F1 — Role-bypass trigger lacks hardened search_path

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20260817120000_profiles_role_bypass_rls.sql:11
- **Detail**: Bypass check uses unqualified `pg_roles` with no `SET search_path`. Under INVOKER, `pg_temp` can precede `pg_catalog`. Authenticated self-promotion is still blocked by RLS `profiles_update_own`, so this is defense-in-depth, not an immediate PostgREST hole.
- **Fix A ⭐ Recommended**: Follow-up migration: `SET search_path = ''` and qualify `pg_catalog.pg_roles`; keep SECURITY INVOKER and `current_user`
  - Strength: Matches F-01 F7 hardening of `is_admin` / `handle_new_user`.
  - Tradeoff: Another migration.
  - Confidence: HIGH — same pattern already shipped in this repo.
  - Blind spot: None significant.
- **Fix B**: Leave as-is; document reliance on RLS as the primary lock
  - Strength: Zero more schema churn.
  - Tradeoff: Trigger is weaker defense-in-depth than intended.
  - Confidence: MEDIUM — RLS currently covers the app path.
  - Blind spot: Any future RLS change could reopen the gap.
- **Decision**: FIXED via Fix A — migration `20260823120000_harden_role_bypass_search_path.sql`

### F2 — Catalog list endpoints have no pagination

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/services/catalog.ts:54
- **Detail**: `listApproved` / `listAll` return all rows up to PostgREST `max_rows` (1000). Plan accepted this for MVP, but truncation is silent — admin/user UIs can look complete while omitting rows.
- **Fix**: Document the 1000-row cap in README/plan Migration Notes, or add a hard `limit` + truncated flag in a follow-up (S-06 / S-02).
- **Decision**: FIXED — documented in README, plan Migration Notes, and `catalog.ts` JSDoc; pagination deferred to S-02/S-06

### F3 — Middleware ignores profiles query errors

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/middleware.ts:30
- **Detail**: Profile `SELECT` discards `{ error }`. Any failure becomes `profile = null` → real admins get 403 with no signal, indistinguishable from non-admin.
- **Fix**: On `error`, log and fail closed with 500 for `/api/admin` / admin HTML (or rewrite to an error page) instead of treating as non-admin.
- **Decision**: FIXED — profile lookup errors log and return 500 on `/api/admin` and `/admin` instead of 403-as-non-admin

### F4 — CatalogList fetch paths lack try/catch

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/admin/CatalogList.tsx:27
- **Detail**: `refresh` / `patchStatus` assume JSON and do not catch network failures (unlike `useCatalogForm`). Unhandled rejections leave the error banner unused.
- **Fix**: Wrap fetch/json in try/catch and set the list error string.
- **Decision**: FIXED — `refresh` / `patchStatus` catch network failures and set error banner

### F5 — Approve/Reject buttons not disabled during PATCH

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/admin/CatalogList.tsx:46
- **Detail**: `isPending` only tracks filter `useTransition`. Concurrent Approve/Reject clicks can race refreshes.
- **Fix**: Shared pending flag that disables Approve/Reject while a status PATCH is in flight.
- **Decision**: FIXED — `statusPending` + `actionsDisabled` gates Approve/Reject (and filter) during PATCH

### F6 — shadcn Select installed but unused

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/admin/CatalogList.tsx (filter) / src/components/ui/select.tsx
- **Detail**: Plan required adding `select`; list filter uses a native `<select>` instead. Behavior matches the plan; dependency/UI surface is slightly inconsistent.
- **Fix**: Wire the filter to shadcn Select, or note the native control as an accepted deviation in the plan.
- **Decision**: FIXED — status filter uses shadcn `Select`

### F7 — Missing Supabase shows empty catalog lists

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/pages/catalog.astro:6 / src/pages/admin/catalog.astro:7
- **Detail**: `createClient` null → `[]` empty UI. Edit `[id].astro` correctly shows a config error. Operators can misread “no items” as an empty catalog.
- **Fix**: Align list pages with the edit page’s config-error handling.
- **Decision**: FIXED — `/catalog` and `/admin/catalog` show config error + 500 when Supabase client is missing
