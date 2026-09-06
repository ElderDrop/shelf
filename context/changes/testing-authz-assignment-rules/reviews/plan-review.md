<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Testing Authz & Assignment Rules

- **Plan**: context/changes/testing-authz-assignment-rules/plan.md
- **Mode**: Deep
- **Date**: 2026-09-06
- **Verdict**: SOUND
- **Findings**: 0 critical 1 warning 2 observations
- **Note**: Retrospective — change already `impl_reviewed`; status not regressed to `plan_reviewed`.

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | PASS |
| Plan Completeness | PASS |

## Grounding

5/5 paths ✓, 6/6 symbols ✓ (`PATCH`, `requireAdmin`, `createClient`, `update`, `assertNotLibraryToWishlist`, `assign`/`updateListType`), brief↔plan ✓. Progress↔Phase: 3/3 phases aligned; 0 checkboxes in phase bodies; success criteria mirrored in Progress.

## Findings

### F1 — Plan mandates exporting demotion helper when service tests already suffice

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Lean Execution
- **Location**: Desired End State #3; Phase 2 — Export demotion helper
- **Detail**: Plan requires exporting `assertNotLibraryToWishlist` for a pure oracle, while the same phase also proves demotion via `assign` / `updateListType` (no `.update`). Export widens a security-adjacent module API for little extra signal beyond message/shape checks. Research offered “export or exercise via service”; plan locked export.
- **Fix A ⭐ Recommended**: Prefer service-path demotion tests as load-bearing; keep export optional / `@internal` if retained for pure message tests.
  - Strength: Smaller public surface; matches later impl-review Fix A outcome.
  - Tradeoff: Pure suite alone is not an enforcement oracle (already true).
  - Confidence: HIGH — only test file imports the export today.
  - Blind spot: None significant.
- **Fix B**: Keep mandatory export as written for an independent pure oracle.
  - Strength: Fast unit without mock sequencing.
  - Tradeoff: Public symbol for an app-only authz rule.
  - Confidence: MEDIUM — plan already chose this path and shipped.
  - Blind spot: Future production imports of the helper.
- **Decision**: FIXED via Fix A — plan prefers service-path demotion; export optional/@internal

### F2 — Risk #3 prove surface intentionally skips middleware

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Implementation Approach; plan-brief Open Risks
- **Detail**: Handler + fake context locks route `requireAdmin`, not middleware `isApiAdmin`. Brief already records dual-gate drift as accepted. End state for “cannot approve” is met at the route layer; full multi-gate Risk #3 remains partially open by design (NOT Doing: middleware-in-process).
- **Fix**: No plan edit required unless product wants middleware unit added as a follow-up phase.
- **Decision**: FIXED — optional middleware-unit follow-up noted under NOT Doing / brief Open Risks

### F3 — §3 rollout status flip not a Phase 3 success criterion

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 3 Overview (“orchestrator may already say researched/planned”)
- **Detail**: Cookbook updates are success-criteria’d; marking test-plan §3 Phase 2 `complete` is only implied. That left an uncommitted status cell after epilogue until triage.
- **Fix**: Add an automated or manual Progress item: “§3 Phase 2 Status → complete (committed).”
- **Decision**: FIXED — Phase 3 success/Progress item for §3 Status → complete (committed)

## Triage summary

- Fixed: F1 (Fix A), F2, F3
- Verdict after fixes: SOUND (Lean Execution WARNING → PASS after F1)
