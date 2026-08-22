<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Admin Catalog Creation and Approval

- **Plan**: context/changes/admin-catalog-approval/plan.md
- **Mode**: Deep
- **Date**: 2026-08-17
- **Verdict**: SOUND
- **Findings**: 0 critical 3 warnings 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | WARNING |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

Pre-triage overall: **REVISE**. After fixes: **SOUND**.

## Grounding

Grounding: 11/11 existing paths ✓, 6/6 symbols ✓, brief↔plan ✓ (create-paths `403.astro`, `catalog.ts`, `/catalog`, `/admin/catalog` correctly absent)

## Findings

### F1 — 403.astro will not return HTTP 403 by itself

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Completeness
- **Location**: Phase 1 — Forbidden page + middleware
- **Detail**: Astro only special-cases `/404` and `/500`. `src/pages/403.astro` is a normal route (`GET /403` → 200) unless status is set. `rewrite("/403")` without wrapping the Response also yields 200. Phase 1 criteria require “returns 403”.
- **Fix A ⭐ Recommended**: `rewrite("/403")` then `new Response(body, { status: 403, headers })`; set `Astro.response.status = 403` in the page
  - Strength: `/admin` URL preserved; Layout chrome reused.
  - Tradeoff: Easy to forget wrapping the rewrite Response.
  - Confidence: HIGH — Astro 6.4.8 has rewrite + Response wrapping.
  - Blind spot: Rewrite re-runs middleware; `/403` is not an admin prefix so it should not loop.
- **Fix B**: Middleware returns `new Response(html, { status: 403 })` and skip `403.astro`
  - Strength: Status is unambiguous.
  - Tradeoff: HTML lives in middleware; Layout/Topbar harder to reuse.
  - Confidence: HIGH.
  - Blind spot: Harder to share chrome with other error pages.
- **Decision**: FIXED via Fix A

### F2 — PATCH allows status=pending, which the plan forbids

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: End-State Alignment
- **Location**: Phase 2 schemas vs What We're NOT Doing
- **Detail**: NOT Doing lists un-approve-to-pending. PATCH status enum was `pending | approved | rejected`, so the API could hide an approved item by setting `pending` even if the UI only had Approve/Reject.
- **Fix**: Restrict PATCH status to `approved | rejected`. New items stay `pending` via POST.
- **Decision**: FIXED

### F3 — Trigger bypass can invert if copied as SECURITY DEFINER

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 1 — Role-change trigger + Critical Implementation Details
- **Detail**: Neighboring helpers (`is_admin`, `handle_new_user`) are SECURITY DEFINER. If the replacement trigger is DEFINER, `current_user` becomes the owner and every client can change `role`. `session_user` would also fail the Phase 1 “self-update still fails” check.
- **Fix**: State in Critical Implementation Details: keep SECURITY INVOKER; use `current_user` (not `session_user`); do not copy DEFINER from `is_admin()`.
- **Decision**: FIXED

### F4 — Layout Topbar hits auth pages; Catalog/Admin links 404 until later phases

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 — Shared Topbar
- **Detail**: Layout is used by signin, signup, confirm-email, and dashboard. Topbar would sit outside their cosmic wrappers. Catalog/Admin hrefs shipped in Phase 1 but the pages arrive in Phases 3–4.
- **Fix**: Note those pages in the Layout contract; defer Catalog/Admin links until the target routes exist (Phase 3 Admin, Phase 4 Catalog).
- **Decision**: FIXED
