<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Tag and Description Recommendations

- **Plan**: `context/changes/tag-recommendations/plan.md`
- **Mode**: Deep
- **Date**: 2026-08-24
- **Verdict**: SOUND
- **Findings**: 1 critical, 2 warnings, 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | WARNING |
| Architectural Fitness | PASS |
| Blind Spots | FAIL |
| Plan Completeness | WARNING |

## Grounding

Grounding: 3/8 paths exist (catalog.ts, middleware.ts, catalog.astro); 5/8 are new or S-02-planned (expected). 3/3 symbols exist (`listApproved`, `PROTECTED_ROUTES`, `jsonOk` pattern). brief↔plan ✓. Progress↔Phase consistency ✓.

## Findings

### F1 — Phase 1 service requires S-02 Phase 1, not only Phase 3

- **Severity**: ❌ CRITICAL
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Plan Completeness
- **Location**: Critical Implementation Details; Phase 1 service
- **Detail**: Plan says "Do not start Phase 2 until S-02 Phase 3 is complete" but Phase 1 `recommendForUser` imports `listForUser` from `assignments.ts`, which does not exist and is delivered by **S-02 Phase 1**. Pure scorer (`score.ts`) can land alone; service + API + Phase 1 manual checks cannot run without assignment data.
- **Fix A ⭐ Recommended**: Split Phase 1 into 1a (scorer only — no S-02 dep) and 1b (service + API + middleware — requires S-02 Phase 1 complete). Update Critical Implementation Details and Prerequisites accordingly.
  - Strength: Lets `/10x-implement tag-recommendations phase 1` start immediately on scorer + golden REPL checks; unblocks parallel work only where safe.
  - Tradeoff: One extra phase boundary to track.
  - Confidence: HIGH — `assignments.ts` and `listForUser` are absent from `src/` today.
  - Blind spot: None significant.
- **Fix B**: Keep single Phase 1 but add explicit gate: "Do not start S-04 until S-02 Phase 1 is complete" (entire change blocked).
  - Strength: Simplest sequencing message; no partial implement confusion.
  - Tradeoff: Scorer work waits on S-02 even though it has zero deps.
  - Confidence: HIGH.
  - Blind spot: None significant.
- **Decision**: FIXED via Fix A — Phase 1 split into scorer (Phase 1) + service/API (Phase 2); S-02 milestone deps documented

### F2 — Manual step 5 assumes users can edit catalog tags

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Testing Strategy — Manual Testing Steps, step 5
- **Detail**: Step says "Remove tags from library until < 3 tagged items." Tags live on `catalog_items`; only admins can UPDATE tags (RLS `catalog_items_update_admin`). Users can only remove assignments or admin can edit catalog tags globally.
- **Fix**: Replace step 5 with: "Remove library assignments (or assign untagged items) until fewer than 3 tagged library items remain; alternatively admin clears tags on catalog items."
- **Decision**: FIXED — manual step 5 updated in plan

### F3 — Double `listForUser` fetch for seed vs exclusions

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Lean Execution
- **Location**: Phase 1 — recommendations service contract
- **Detail**: `recommendForUser` calls `listForUser(client, "library")` then `listForUser(client)` unfiltered for exclusion ids — two round trips when one unfiltered call could derive both seed and exclusion set.
- **Fix**: Single `listForUser(client)` call; filter to library for seeds/gate; use full result for assigned id set.
- **Decision**: FIXED — Phase 2 service contract updated

### F4 — "Optional" API vs Phase 1 required deliverable

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Desired End State item 5 vs Phase 1 API section
- **Detail**: Desired End State labels `GET /api/recommendations` as "Optional" but Phase 1 builds it as a required deliverable with manual verification. Wording inconsistency only — behavior is clear.
- **Fix**: Change Desired End State item 5 to "GET /api/recommendations returns…" (drop "Optional") or mark Phase 1 API as optional/deferred.
- **Decision**: FIXED — "Optional" removed from Desired End State item 5
