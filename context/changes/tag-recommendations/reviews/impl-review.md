<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Tag and Description Recommendations

- **Plan**: `context/changes/tag-recommendations/plan.md`
- **Scope**: Full plan (Phases 1–4 of 4)
- **Date**: 2026-08-30
- **Verdict**: APPROVED (after triage fixes)
- **Findings**: 0 critical, 3 warnings, 2 observations (all triaged)

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | WARNING |

## Automated verification (this review)

| Check | Result |
|-------|--------|
| `npm run lint` | PASS (0 errors; pre-existing `no-console` warning in middleware) |
| `npm run build` | PASS |
| Unauth `GET /api/recommendations` | PASS — `401 {"error":"Unauthorized"}` |
| Golden A/B via `tsx` | PASS — A: `x,y,z`; B: `r,p` |

## Findings

### F1 — Library SSR fails entirely if recommendations fail

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: `src/pages/library.astro:19`
- **Detail**: `Promise.all([listForUser(..., "library"), recommendForUser(...)])` couples the primary library list to recommendations. A failure inside `recommendForUser` (catalog or assignments error) rejects the whole page, so users lose their library view when an optional discovery block fails.
- **Fix A ⭐ Recommended**: Load library assignments independently; wrap `recommendForUser` in try/catch (or `Promise.allSettled`) and fall back to gate/empty recommendations UI on failure.
  - Strength: Library remains usable; recommendations degrade gracefully.
  - Tradeoff: Slightly more branching in the Astro frontmatter.
  - Confidence: HIGH — catalog/wishlist pages already isolate a single load path.
  - Blind spot: Exact fallback copy for “recommendations unavailable” not specified in plan.
- **Fix B**: Keep `Promise.all` and document that recommendations are required for `/library` SSR.
  - Strength: Zero code change; failures stay loud.
  - Tradeoff: Library list unavailable on recommendation/catalog outages.
  - Confidence: MEDIUM — acceptable only if outages are rare and ops prefer fail-loud.
  - Blind spot: No evidence of how often `listApproved` fails in prod.
- **Decision**: FIXED via Fix A — isolate recommendForUser in try/catch; library list loads independently; unavailable copy on failure

### F2 — Recommendations API never maps typed dependency errors

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: `src/pages/api/recommendations.ts:15-19`, `src/lib/services/recommendations.ts:14-24`
- **Detail**: `recommendForUser` never throws `RecommendationsServiceError`; failures bubble as `AssignmentServiceError` / `CatalogServiceError`. The route only special-cases `RecommendationsServiceError`, so real DB failures always become opaque `500 "Unexpected error"`. Sibling assignment API maps typed codes to 403/404/400.
- **Fix**: Catch `AssignmentServiceError` / `CatalogServiceError` in the route (or wrap them in `RecommendationsServiceError` inside the service) and map codes like `assignments.ts`.
- **Decision**: FIXED — map AssignmentServiceError and CatalogServiceError to 404/403/400 like assignments API

### F3 — Manual Progress rows lack observable evidence beyond user “confirm”

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: Progress 2.4, 3.3–3.5, 4.3–4.5
- **Detail**: Automated checks and golden A/B / unauth 401 have evidence in this review. Several Manual rows (authenticated eligible true/false, library gate UI, E2E assign-from-recommendation, second-user RLS, scenario C) were marked complete after conversational “confirm” without logged curl/browser artifacts in the change folder. Risk of rubber-stamping.
- **Fix**: Spot-check the three highest-risk manuals (2.4 eligible-false with seeded library, 4.3 assign-from-recommendation, 4.5 exclusions) once in the running app, or record a short verification note under `context/changes/tag-recommendations/follow-ups/`.
- **Decision**: FIXED — spot-check checklist written to `follow-ups/review-fixes.md` (2.4 / 4.3 / 4.5)

### F4 — Island hydrate directive differs from plan text

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: `src/pages/library.astro:64`
- **Detail**: Plan specified `client:load`; implementation uses `client:only="react"`, matching `catalog.astro` and collection islands from S-02. Behavior is correct; plan text is stale.
- **Fix**: Amend plan Phase 3 contract to `client:only="react"` (or leave as known S-02 alignment).
- **Decision**: FIXED — plan Phase 3 amended to `client:only="react"` (matches catalog / S-02)

### F5 — Duplicate `listForUser` on `/library` SSR

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: `src/pages/library.astro:19`, `src/lib/services/recommendations.ts:49`
- **Detail**: Page loads library assignments; `recommendForUser` loads all assignments again. Matches the plan’s “alongside” wording and is fine at ≤1000-row MVP scale, but is redundant.
- **Fix**: Optional follow-up: pass seeds/exclusion IDs into `recommendForUser` or share one assignments fetch — not required for MVP.
- **Decision**: FIXED — recommendForUser accepts optional assignments; /library shares one listForUser fetch

## Triage complete

| Finding | Decision |
|---------|----------|
| F1 | FIXED via Fix A — isolate recommendations try/catch |
| F2 | FIXED — map Assignment/Catalog service errors in API |
| F3 | FIXED — spot-check checklist in `follow-ups/review-fixes.md` |
| F4 | FIXED — plan amended to `client:only="react"` |
| F5 | FIXED — shared assignments fetch via `RecommendForUserOptions` |
