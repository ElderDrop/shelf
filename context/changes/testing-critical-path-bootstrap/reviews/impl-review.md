<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Testing Critical-Path Bootstrap

- **Plan**: context/changes/testing-critical-path-bootstrap/plan.md
- **Scope**: All phases (1–3)
- **Date**: 2026-09-01
- **Verdict**: APPROVED
- **Findings**: 0 critical 2 warnings 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | WARNING |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Automated verification

| Command | Result |
|---------|--------|
| `npm test` | PASS — 3 files, 6 tests |
| `npm run lint` | PASS — 0 errors (2 pre-existing console warnings elsewhere) |

## Findings

### F1 — test-plan §3 Phase 1 row still lists Risk #2

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: context/foundation/test-plan.md:68
- **Detail**: §3 row lists Risks `#1, #2` and goal “assignment ownership,” while frame deferred #2, §6.6 notes deferral, and shipped code has no assignment/IDOR tests. Rollout table contradicts actual scope.
- **Fix**: Update §3 Phase 1 “Risks covered” to `#1` only and narrow goal text to pending-visibility (or run `/10x-test-plan --refresh` per §6.6).
- **Decision**: FIXED — narrowed §3 Phase 1 row and §6.6 note

### F2 — Duplicate admin gate: middleware + requireAdmin

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Architecture
- **Location**: src/middleware.ts:70-77, src/lib/require-admin.ts:16-20
- **Detail**: Same `profile?.role === "admin"` check exists in middleware (primary) and extracted `requireAdmin` (defense-in-depth). Behavior matches today; future edits to one path without the other could reopen admin API access.
- **Fix A ⭐ Recommended**: Add JSDoc cross-links (“must stay aligned with middleware admin API branch”) on both sides until Phase 2 consolidates.
  - Strength: Zero behavior change; documents coupling for Phase 2 authz work.
  - Tradeoff: Does not remove duplication.
  - Confidence: HIGH — matches plan’s Phase 2 scope for full Risk #3.
  - Blind spot: None significant.
- **Fix B**: Have middleware call shared `requireAdmin` after 401 check (single source of truth).
  - Strength: One predicate to maintain.
  - Tradeoff: Middleware must import helper; slightly wider coupling.
  - Confidence: MEDIUM — needs care for HTML vs JSON response paths.
  - Blind spot: `/admin` page rewrite vs JSON 403 semantics.
- **Decision**: FIXED via Fix A — JSDoc cross-links on middleware and requireAdmin

### F3 — test-plan Phase 5 status stale after CI wiring

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: context/foundation/test-plan.md:72, :102
- **Detail**: `npm test` runs in CI (Phase 3 deliverable) but §3 Phase 5 “Quality-gates wiring” remains `not started`. §5 notes early wiring; orchestrator may suggest redundant work.
- **Fix**: Note in §6.6 that CI gate landed early, or mark Phase 5 partial/complete with a one-line scope note on next `/10x-test-plan` resume.
- **Decision**: FIXED — §6.6 Phase 5 note and clarified §3 Phase 5 goal

### F4 — requireAdmin returns 403 for null profile (not 401)

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/require-admin.ts:17-18
- **Detail**: Unauthenticated (`profile: null`) gets 403 from route helper; middleware returns 401 first. Pre-existing semantics from inline helper; safe while middleware runs. Test covers null profile intentionally.
- **Fix**: Document in `requireAdmin` JSDoc that middleware owns 401; route helper is defense-in-depth only.
- **Decision**: FIXED — JSDoc documents middleware 401 vs route 403
