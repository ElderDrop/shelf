<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Catalog Schema and RLS Implementation Plan

- **Plan**: context/changes/catalog-schema-rls/plan.md
- **Scope**: Phase 1 (partial — automated complete, manual pending); Phases 2–3 not started
- **Date**: 2026-08-09
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 3 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | WARNING |

## Findings

### F1 — RLS enabled without policies is a deploy gate

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20260608120000_catalog_schema.sql:107-110
- **Detail**: RLS is enabled on all three domain tables but no `CREATE POLICY` statements exist yet (Phase 2). This is fail-closed — no row leakage — but any remote deploy of Phase 1 alone denies all `anon`/`authenticated` table access until policies land. Signup profile provisioning still works via `handle_new_user()` (SECURITY DEFINER).
- **Fix**: Do not push this migration to production until Phase 2 policies ship in the same deploy (append to this file or immediate follow-up migration). Add a deploy-checklist note in S-01 or migration notes.
  - Strength: Matches plan's phased intent; prevents accidental availability break.
  - Tradeoff: Blocks independent Phase 1 production rollout (plan already assumes single-transaction apply).
  - Confidence: HIGH — standard Supabase deny-by-default behavior.
  - Blind spot: None significant.
- **Decision**: FIXED — deploy gate documented in migration comment and plan Migration Notes.

### F2 — Missing FK index on user_assignments.catalog_item_id

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20260608120000_catalog_schema.sql:29-36
- **Detail**: `catalog_item_id` is a foreign key with `ON DELETE CASCADE` but has no supporting index. Admin deletes or catalog-item joins will seq-scan `user_assignments` at scale.
- **Fix**: Add `CREATE INDEX user_assignments_catalog_item_id_idx ON public.user_assignments (catalog_item_id);` to the migration before Phase 2 ships.
- **Decision**: FIXED — index added to migration.

### F3 — Phase 1 manual verification still pending

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Success Criteria
- **Location**: context/changes/catalog-schema-rls/plan.md:259-261
- **Detail**: Progress marks automated steps 1.1–1.3 complete (migration exists; lint and build pass). Manual steps 1.4–1.6 remain unchecked: `npx supabase db reset`, psql table inspection, and signup profile trigger. Review could not run `db reset` — local Supabase is not running. Plan explicitly pauses for human confirmation before Phase 2.
- **Fix A ⭐ Recommended**: Run manual verification now (`npx supabase start`, `npx supabase db reset`, psql `\d` checks, signup flow) and check off 1.4–1.6 before starting Phase 2.
  - Strength: Plan gate; catches SQL/runtime issues before RLS layer.
  - Tradeoff: Requires local Docker/Supabase setup.
  - Confidence: HIGH — plan's own checkpoint.
  - Blind spot: Remote-only environments may differ from local.
- **Fix B**: Proceed to Phase 2 in same migration file and verify both phases together in one `db reset`.
  - Strength: Single verification pass.
  - Tradeoff: Harder to isolate Phase 1 DDL issues if reset fails.
  - Confidence: MEDIUM — acceptable if time-constrained.
  - Blind spot: Phase 1-only failures harder to diagnose.
- **Decision**: PENDING — deferred; user will run manual verification locally (Docker unavailable in review environment)
- **Guide**: [F3 manual verification steps](../follow-ups/f3-manual-verification.md)

### F4 — seed.sql referenced in config but absent

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: supabase/config.toml:65
- **Detail**: `sql_paths = ["./seed.sql"]` but `supabase/seed.sql` does not exist. May cause warnings or failures on `db reset` once Supabase is running.
- **Fix**: Add an empty `supabase/seed.sql` or remove/adjust `sql_paths` in config.
- **Decision**: FIXED — added empty `supabase/seed.sql` with placeholder comment.

### F5 — is_admin() granted to PUBLIC by default

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20260608120000_catalog_schema.sql:105
- **Detail**: `GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated` without revoking PUBLIC. Anonymous callers can invoke the function (returns `false` when unauthenticated). Low risk but slightly broader surface than necessary.
- **Fix**: Add `REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;` before the authenticated grant.
- **Decision**: FIXED — REVOKE added before authenticated GRANT in migration.

## Triage Summary

- **Fixed**: F1, F2, F4, F5 (4)
- **Pending**: F3 — deferred; run manual verification locally before Phase 2
