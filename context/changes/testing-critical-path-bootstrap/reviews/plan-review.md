<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Testing Critical-Path Bootstrap

- **Plan**: context/changes/testing-critical-path-bootstrap/plan.md
- **Mode**: Deep
- **Date**: 2026-08-31
- **Verdict**: SOUND (after triage fixes; was REVISE)
- **Findings**: 1 critical 2 warnings 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | WARNING → addressed |
| Architectural Fitness | PASS |
| Blind Spots | FAIL → addressed (F1) |
| Plan Completeness | WARNING → addressed |

## Grounding

7/7 existing modify-paths ✓, new files expected MISSING ✓, 3/3 symbols ✓, brief↔plan ✓

## Findings

### F1 — Admin GET import fails under Node Vitest

- **Severity**: ❌ CRITICAL
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 2 — Non-admin admin catalog GET → 403
- **Detail**: Importing exported GET loads @/lib/supabase → astro:env/server at module eval; Node Vitest fails before requireAdmin short-circuit.
- **Fix A ⭐ Recommended**: Extract requireAdmin to src/lib/; unit-test helper; update both admin route files.
- **Fix B**: vi.mock(@/lib/supabase) and test exported GET.
- **Decision**: FIXED via Fix A

### F2 — Phase 1 smoke test is optional/ambiguous

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Lean Execution
- **Location**: Phase 1 — Smoke test
- **Detail**: Plan allowed skipping smoke if Phase 2 landed same delivery.
- **Fix**: Require catalog.smoke.test.ts with @/ import; no skip language.
- **Decision**: FIXED

### F3 — Progress 2.2 not mirrored in Phase 2 Success Criteria bullets

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 Success Criteria vs Progress
- **Detail**: Progress steps finer than Success Criteria bullets.
- **Fix**: Align Automated Success Criteria 1:1 with Progress 2.1–2.5.
- **Decision**: FIXED

### F4 — CLAUDE.md has no “no test runner” line

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Lean Execution
- **Location**: Phase 3 — CLAUDE.md
- **Detail**: Conditional CLAUDE.md item unnecessary; no conflicting guidance in CLAUDE.md.
- **Fix**: Remove Phase 3 CLAUDE.md item.
- **Decision**: FIXED
