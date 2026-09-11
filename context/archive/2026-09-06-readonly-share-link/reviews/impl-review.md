<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Read-Only Share Link Implementation Plan

- **Plan**: `context/changes/readonly-share-link/plan.md`
- **Scope**: Phases 1–4 of 4 (full plan)
- **Date**: 2026-09-07
- **Verdict**: APPROVED
- **Findings**: 0 critical 2 warnings 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | WARNING |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Automated checks (this review)

- `npm test` — 34 passed
- `npm run lint` — exit 0 (pre-existing console warnings only)

## Findings

### F1 — Unplanned service_role SELECT grants migration

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: `supabase/migrations/20260906130000_service_role_share_select.sql`
- **Detail**: Plan Phase 1 did not list grants to `service_role`. Added during manual verification when `sb_secret_*` keys got `42501 permission denied` on resolve. SELECT-only on `share_links`, `user_assignments`, `catalog_items` — no writes, no anon.
- **Fix**: Document in plan as an addendum / Migration Notes (keep migration).
- **Decision**: FIXED — Migration Notes addendum documenting service_role SELECT grants

### F2 — Rotate delete-then-insert can leave no active link

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: `src/lib/services/share.ts` (`createOrRotateShareLink`)
- **Detail**: `createOrRotateShareLink` deleted the existing row then inserted. If insert failed after delete, the prior token was already invalid and the owner had no active link until retry.
- **Fix A ⭐ Recommended**: Rotate via `UPDATE token_hash` (and `created_at`) on the existing row when present; insert only when absent. Keep DELETE path for revoke.
  - Strength: Single-row update; no window without a link if hash update fails.
  - Tradeoff: Small service change + test update.
  - Confidence: HIGH — UNIQUE(user_id) already enforces one row.
  - Blind spot: Concurrent double-POST still possible without DB transaction (acceptable for MVP).
- **Fix B**: Wrap delete+insert in a SECURITY DEFINER RPC transaction.
  - Strength: Strongest atomicity.
  - Tradeoff: New migration + RPC; plan preferred app-side service role over DEFINER for resolve (this would only be for owner rotate).
  - Confidence: MEDIUM — more moving parts.
  - Blind spot: RPC grant surface to authenticated.
- **Decision**: FIXED — Fix A: rotate via UPDATE; INSERT only when absent; revoke still DELETE

### F3 — Resolve path lacks max_rows documentation

- **Severity**: 💭 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: `src/lib/services/share.ts:206-211`
- **Detail**: Same silent PostgREST ~1000-row cap as `listForUser`, but `assignments.ts` documents it and resolve does not.
- **Fix**: Copy the one-line cap comment onto `resolveShareByToken`.
- **Decision**: FIXED — max_rows comment on `resolveShareByToken`
