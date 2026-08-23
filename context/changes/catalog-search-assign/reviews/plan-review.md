<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Catalog Search, Assign, and Library View

- **Plan**: `context/changes/catalog-search-assign/plan.md`
- **Mode**: Deep
- **Date**: 2026-08-23
- **Verdict**: SOUND (after triage fixes)
- **Findings**: 0 critical · 5 warnings · 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | WARNING → PASS (after F1) |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING → PASS (after F2, F4) |
| Plan Completeness | WARNING → PASS (after F3, F5) |

## Grounding

Grounding: 7/7 existing paths ✓, 4/4 new paths correctly absent ✓, brief↔plan ✓

## Findings

### F1 — Tag search semantics oversold

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: End-State Alignment
- **Location**: Critical Implementation Details + Phase 2
- **Detail**: Plan promised case-insensitive substring tag match; PostgREST `tags.cs` is exact element match only.
- **Fix A ⭐ Recommended**: Tighten wording — ilike on title/description + exact tag element via `tags.cs`.
- **Decision**: FIXED via Fix A

### F2 — PostgREST filter escaping not specified

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 2 — listApproved search
- **Detail**: Raw user input in `.or()` filter breaks on commas, parens, or unescaped `%`/`_`.
- **Fix**: Add explicit escaping contract to Phase 2 listApproved.
- **Decision**: FIXED (incorporated with F1 edit)

### F3 — CatalogItemActions props contradictory

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Completeness
- **Location**: Phase 2 — items 2 vs 3
- **Detail**: §2 described list-level props; §3 described per-row props.
- **Fix A ⭐ Recommended**: Per-row island in catalog.astro loop.
- **Decision**: FIXED via Fix A

### F4 — Null-embed UI for rejected items underspecified

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 3 + Critical Implementation Details
- **Detail**: Rejected catalog items embed as null; no UI contract for collection pages.
- **Fix**: Phase 3 — show unavailable copy + Remove only; map embed key in service.
- **Decision**: FIXED

### F5 — Upsert UPDATE key not specified

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 — assign() contract
- **Detail**: POST upsert path must UPDATE by `catalog_item_id`, not assignment id.
- **Fix**: Specify UPDATE filter and 403 mapping on rejected target.
- **Decision**: FIXED

### F6 — Phase 4 is verification-only

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Lean Execution
- **Location**: Phase 4
- **Detail**: Phase 4 is mostly JSDoc + E2E checklist; could merge into Phase 3.
- **Fix A ⭐ Recommended**: Keep as explicit integration gate (matches S-01 rhythm).
- **Decision**: ACCEPTED (Fix A — keep as-is)
