<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Testing Authz & Assignment Rules

- **Plan**: context/changes/testing-authz-assignment-rules/plan.md
- **Scope**: All phases (1–3)
- **Date**: 2026-09-06
- **Verdict**: APPROVED
- **Findings**: 0 critical 1 warning 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | WARNING |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Automated verification

| Command | Result |
|---------|--------|
| `npm test` | PASS — 5 files, 17 tests |
| `npm run lint` | PASS — 0 errors (2 pre-existing console warnings elsewhere) |

## Findings

### F1 — Public export of demotion helper widens security-adjacent API

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Architecture
- **Location**: src/lib/services/assignments.ts:92
- **Detail**: Plan intentionally exported `assertNotLibraryToWishlist` for a pure oracle. Demotion is app-only (not RLS). A public export can invite callers to treat the helper as a standalone authz API; only tests import it today. Service-path tests already prove demotion without the export.
- **Fix A ⭐ Recommended**: Keep export (matches plan) but add a short JSDoc `@internal` / “call assign/updateListType — not a public authz boundary.”
  - Strength: Preserves planned pure-oracle tests; documents intent.
  - Tradeoff: Symbol stays public in the module.
  - Confidence: HIGH — only test importer today.
  - Blind spot: Future accidental production imports.
- **Fix B**: Un-export and rely only on `assign` / `updateListType` demotion tests.
  - Strength: Smaller API surface.
  - Tradeoff: Diverges from written plan; loses independent pure suite.
  - Confidence: MEDIUM — plan explicitly chose export.
  - Blind spot: None significant.
- **Decision**: FIXED via Fix A — JSDoc @internal / not a public authz boundary

### F2 — test-plan §3 Phase 2 `complete` flip still uncommitted

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: context/foundation/test-plan.md (working tree)
- **Detail**: Working tree sets §3 Phase 2 Status to `complete`, but that edit was left out of the epilogue commit (epilogue only staged change-folder files). Cookbook §6 is committed; status cell may lag for `/10x-test-plan` resume.
- **Fix**: Commit the §3 status flip (or include it next time `/10x-test-plan` / archive runs).
- **Decision**: FIXED — §3 Phase 2 status `complete` committed (with F1 JSDoc)

### F3 — Query mock repeats last sequential result when over-awaited

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/lib/services/__tests__/supabase-query-mock.ts:41-47
- **Detail**: Exhausted `results` sequences reuse the last entry. Current assignment tests assert call counts / outcomes tightly enough; catalog default path unchanged. Risk of false green if a future multi-step test under-specifies awaits.
- **Fix**: Optionally fail when the sequence is exhausted, or document “last repeats” in the mock JSDoc.
- **Decision**: FIXED — documented last-repeats on createSupabaseQueryMock JSDoc
