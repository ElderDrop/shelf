# Tag and Description Recommendations Implementation Plan

## Overview

Deliver FR-007: ranked catalog recommendations for signed-in users based on simple tag/description overlap against items in their **library** (not wishlist). Recommendations appear as a section on `/library`, hidden until the user has at least three library items with tags, excluding items already assigned to library or wishlist. Reuses S-02 assignment islands for assign/move/remove. No ML engine, no FTS migration, no new test runner.

## Current State Analysis

F-01 schema and RLS support the data model. S-01 provides admin catalog CRUD and static approved browse. S-02 is planned but not implemented — it will own `/library`, the assignment service/API, and `CatalogItemActions`. No recommendation code exists.

### Key Discoveries:

- `catalog_items.tags` is `text[]` with GIN index — chosen in F-01 for MVP tag-overlap (`context/changes/catalog-schema-rls/plan.md:56`).
- `listApproved()` returns all approved items with no ranking (`src/lib/services/catalog.ts:55-67`).
- `UserAssignment` / `ListType` types exist but are unused in app code (`src/types.ts:3-28`).
- Middleware protects `/catalog` but not `/library` or user recommendation APIs yet (`src/middleware.ts:4`); S-02 will extend this pattern.
- PRD FR-007 + Business Logic: simple overlap + ranking from approved catalog; secondary bar “≥ 3 pozycje z tagami” (`context/foundation/prd.md:50,96-97,108-112`).

## Desired End State

After this plan completes:

1. User with **≥ 3 library items that each have at least one tag** sees up to **10** recommended approved catalog items on `/library`, ranked by score > 0.
2. Recommendations exclude every catalog item the user has assigned (library or wishlist).
3. Each recommendation row shows title, description, tags, and S-02 assign actions.
4. User with **< 3 tagged library items** sees gate copy only — no recommendation list.
5. `GET /api/recommendations` returns the same ranked list as JSON; unauthenticated → 401 JSON.

**Verification:** lint + build pass; golden fixture scenarios produce documented order; manual walkthrough on `/library`.

## What We're NOT Doing

- ML, collaborative filtering, or custom recommendation engine (PRD Non-Goal).
- Wishlist as recommendation seed (FR-007 names library only).
- Dedicated `/recommendations` page, dashboard widget, or Topbar link for recommendations.
- FTS / `tsvector` migration or tokenization-based description matching.
- Pagination UI for recommendations (top-10 cap; document 1000-row PostgREST cap on underlying catalog fetch).
- Read-only share links (S-05), metadata enrichment (S-03), UI polish pass (S-06).
- New test runner — golden scenarios are documented and verified manually.

## Implementation Approach

Three phases after scorer: service (+ API), library UI section, integration with golden verification. Scoring runs in application code over the approved catalog (MVP scale ≤1000 rows). Service consumes S-02 `listForUser` for library seed and assignment exclusions. SSR on `/library` is the primary UX; API mirrors the service for debugging and golden checks.

**Phase sequencing:** Phase 1 (scorer) has no S-02 dependency. Phases 2–4 require S-02 milestones as noted per phase.

## Critical Implementation Details

**S-02 milestone dependencies:**

- **Phase 1 (scorer):** No S-02 dependency — can start immediately.
- **Phase 2 (service + API):** Requires **S-02 Phase 1** complete (`assignments.ts` with `listForUser`, assignment APIs, middleware JSON 401 for `/api/assignments`).
- **Phase 3 (library UI):** Requires **S-02 Phase 3** complete (`/library` page, `CatalogItemActions` island).

Do not start Phase 2 until S-02 Phase 1 is complete. Do not start Phase 3 until S-02 Phase 3 is complete.

**Gate counts library items with tags, not tag count.** `taggedLibraryCount` = number of library assignments whose embedded `catalog_item.tags.length >= 1`. Recommendations render only when `taggedLibraryCount >= 3`.

**Tag match is exact, case-sensitive** (consistent with S-02 catalog tag search). Description boost uses case-insensitive substring search of each library tag in `title + " " + description`.

**Description boost does not double-count.** A library tag contributes to `descBoost` only when it is **not** already present in `candidate.tags` (exact). Tags already overlapping via `tagScore` are skipped for boost.

## Phase 1: Pure recommendation scorer

### Overview

Introduce deterministic, side-effect-free ranking logic isolated from Supabase. No S-02 dependency — verifiable via golden fixtures in Node REPL or a throwaway script.

### Changes Required:

#### 1. Pure recommendation scorer

**File**: `src/lib/recommendations/score.ts`

**Intent**: Deterministic, side-effect-free ranking logic isolated from Supabase so golden fixtures can be verified without a database.

**Contract**:

- Export types: `RecommendationCandidate` (`id`, `title`, `description`, `tags`), `RecommendationSeed` (same shape, represents library items), `ScoredRecommendation` (`candidate` + `tagScore` + `descBoost` + `totalScore`).
- Export `buildLibraryTagSet(seeds: RecommendationSeed[]): Set<string>` — union of all tags from seed items.
- Export `scoreCandidate(candidate, libraryTagSet): { tagScore, descBoost, totalScore }`:
  - `tagScore` = count of `candidate.tags` that are in `libraryTagSet` (exact match).
  - `descBoost` = for each tag in `libraryTagSet` not in `candidate.tags`, add 1 if `title + " " + description` contains tag case-insensitively; else 0.
  - `totalScore = tagScore + descBoost`.
- Export `rankCandidates(candidates, libraryTagSet, limit = 10): ScoredRecommendation[]` — score all, filter `totalScore > 0`, sort by `totalScore` desc, then `tagScore` desc, then `title` asc (locale-aware string compare), slice to `limit`.
- Export `countTaggedLibraryItems(seeds: RecommendationSeed[]): number` — seeds with `tags.length >= 1`.

#### 2. Golden fixture scenarios (documentation)

**File**: `context/changes/tag-recommendations/plan.md` (Testing Strategy section)

**Intent**: Lock scorer behavior with reproducible inputs → expected order for Phase 4 verification.

**Contract**: Three scenarios documented (see Testing Strategy below): (A) tag overlap dominates, (B) description boost breaks tie when tags sparse, (C) excluded assigned ids never appear in service output (service-level; verified in Phase 4).

### Success Criteria:

#### Automated Verification:

- Linting passes: `npm run lint`
- Production build passes: `npm run build`
- Type checking passes via lint (type-checked ESLint rules)

#### Manual Verification:

- Golden scenarios A–B produce expected order when scorer is invoked with fixture arrays (Node REPL or temporary script — no test runner required)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Recommendations service, API, and middleware

### Overview

Introduce the recommendations service that assembles seed/candidates/exclusions and an JSON API. **Requires S-02 Phase 1** (`listForUser`, assignment APIs).

### Changes Required:

#### 1. Recommendations service

**File**: `src/lib/services/recommendations.ts`

**Intent**: Orchestrate data loading from Supabase session client and delegate ranking to the pure scorer.

**Contract**:

- Export `RecommendationResult` type: `{ eligible: boolean; taggedLibraryCount: number; items: ScoredRecommendation[] }` where `eligible = taggedLibraryCount >= 3`.
- Export `RecommendationsServiceError` mirroring catalog/assignment error pattern (`unknown` code sufficient).
- Export `recommendForUser(client, options?): Promise<RecommendationResult>`:
  1. Use `options.assignments` when provided; otherwise `listForUser(client)` once — build assigned `catalog_item_id` set from all rows (library + wishlist).
  2. Filter rows to `list_type === "library"`; map embedded `catalog_item` to seed shape (skip null embeds).
  3. Compute `taggedLibraryCount` via scorer helper; if `< 3`, return `{ eligible: false, taggedLibraryCount, items: [] }`.
  4. `listApproved(client)` — candidate pool.
  5. Filter candidates: not in assigned id set.
  6. `rankCandidates(filtered, buildLibraryTagSet(seeds))`.
  7. Return `{ eligible: true, taggedLibraryCount, items }`.
- `/library` SSR should pass the shared assignments array so it does not double-fetch `listForUser`.
- JSDoc: documents PostgREST 1000-row silent truncation on `listApproved`.

#### 2. Recommendations JSON API

**File**: `src/pages/api/recommendations.ts`

**Intent**: Expose recommendations for curl/golden verification and optional client fetch.

**Contract**: Export `prerender = false`. `GET` → `{ data: RecommendationResult }` via `jsonOk`. Unauthenticated → 401 JSON `{ error: "Unauthorized" }`. Uses session Supabase client. Map service errors → 500 JSON.

#### 3. Middleware: protect recommendations API

**File**: `src/middleware.ts`

**Intent**: Unauthenticated `fetch` to recommendations API must not receive HTML redirect.

**Contract**: Add `isApiRecommendations(pathname)` for `/api/recommendations` exact match (or prefix if nested later). Unauthenticated + recommendations API → 401 JSON before generic protected-route redirect. `/library` protection is owned by S-02 — verify it exists before Phase 3.

### Success Criteria:

#### Automated Verification:

- Linting passes: `npm run lint`
- Production build passes: `npm run build`
- Type checking passes via lint (type-checked ESLint rules)

#### Manual Verification:

- `GET /api/recommendations` as authenticated user with < 3 tagged library items returns `{ eligible: false, items: [] }`
- Same endpoint with ≥ 3 tagged library items returns ranked items with `totalScore > 0`
- Unauthenticated `GET /api/recommendations` returns 401 JSON

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Library UI recommendations section

### Overview

Add SSR recommendations block to `/library` with gate copy, ranked list, and S-02 assign islands per row.

### Changes Required:

#### 1. Library page — recommendations section

**File**: `src/pages/library.astro` (created by S-02)

**Intent**: Show gated recommendations above or below the library item list on the same page.

**Contract**:

- Call `recommendForUser(supabase)` alongside existing `listForUser(supabase, "library")`.
- When `eligible === false`: render gate section with copy explaining recommendations unlock after **3 library items with tags**; show current count if helpful (`You have N tagged items in your library.`). Do not render recommendation rows.
- When `eligible === true` and `items.length === 0`: render section heading + copy `No recommendations match your library yet.`
- When `eligible === true` and `items.length > 0`: render “Recommended for you” heading + list (title, description, tags, score optional for dev-only — omit in production UI).
- For each recommendation row, hydrate `CatalogItemActions` island (`client:only="react"`) with `catalogItemId` and no current `listType` (unassigned by definition). Reuse S-02 component from `src/components/catalog/CatalogItemActions.tsx`.
- Match existing zinc palette / list spacing from `/catalog` and S-02 library list.

#### 2. Assignment state bootstrap for recommendations (if needed)

**File**: `src/pages/library.astro`

**Intent**: If assign island needs assignment id after user assigns from recommendations section, page reload on success (S-02 pattern) is sufficient — no extra state map required for initial unassigned rows.

**Contract**: Prefer full page reload on assign success (same as S-02 catalog). Recommendation rows disappear after assign because item enters exclusion set.

### Success Criteria:

#### Automated Verification:

- Linting passes: `npm run lint`
- Production build passes: `npm run build`

#### Manual Verification:

- User with < 3 tagged library items sees gate copy only on `/library`
- User with ≥ 3 tagged library items sees up to 10 recommendations
- Assign from recommendation row → item appears in library/wishlist per action; recommendation row gone on refresh
- Items already in library or wishlist never appear in recommendations

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Integration and golden verification

### Overview

End-to-end validation, README touch-up, and golden fixture walkthrough — no new features.

### Changes Required:

#### 1. README route documentation

**File**: `README.md`

**Intent**: Document recommendations behavior and API for operators/testers.

**Contract**: Note `/library` recommendations section, gate rule (≥ 3 tagged library items), `GET /api/recommendations`, top-10 cap, library-only seed, exclusions (library + wishlist).

#### 2. Golden fixture verification

**File**: `context/changes/tag-recommendations/plan.md` (Progress Phase 4)

**Intent**: Human verifies scorer + service against documented fixtures.

**Contract**: Complete manual steps in Testing Strategy golden scenarios A–C with seeded catalog + library data (via S-01 admin + S-02 assign flow).

### Success Criteria:

#### Automated Verification:

- Linting passes: `npm run lint`
- Production build passes: `npm run build`

#### Manual Verification:

- Full flow: seed catalog → assign ≥ 3 tagged items to library → `/library` shows recommendations → assign one recommendation → it leaves list and appears in collection
- Second user's recommendations differ (RLS isolation — each user's library seeds own ranking)
- Golden scenarios A–B order matches documented expectation
- Scenario C: assigned item ids absent from API and UI lists

---

## Testing Strategy

### Unit Tests:

- None — no test runner unless this change introduces one. Scorer verified via golden fixtures.

### Integration Tests:

- Manual API checks in Phase 2
- End-to-end collector + recommendations flow in Phase 4

### Golden Fixture Scenarios (manual)

**Scenario A — Tag overlap dominates**

- Library seeds: `{ tags: ["fantasy", "series"] }`, `{ tags: ["fantasy"] }`, `{ tags: ["horror"] }` (3 tagged items → eligible).
- Candidates (unassigned):  
  - X: tags `["fantasy", "series"]` → tagScore 2  
  - Y: tags `["fantasy"]` → tagScore 1  
  - Z: tags `["horror"]` → tagScore 1  
- Expected order: X, then Y and Z tied on score — tie-break title asc among Y/Z.

**Scenario B — Description boost breaks tie**

- Library tag set: `["dragon"]`.
- Candidate P: tags `[]`, title `"Dragon Age"` → tagScore 0, descBoost 1, total 1.
- Candidate Q: tags `[]`, description unrelated → total 0 (excluded).
- Candidate R: tags `["dragon"]` → tagScore 1, total 1 ( ranks above P if both present — higher tagScore tie-break).

**Scenario C — Exclusions**

- User has item A in library and item B in wishlist.
- Approved catalog includes A, B, C.
- `recommendForUser` returns only C (if C scores > 0); never A or B.

### Manual Testing Steps:

1. Via admin, create ≥ 5 approved items with varied tags (some overlapping).
2. Sign in as user; assign 3+ items to library with tags; assign 1 overlapping item to wishlist only.
3. Open `/library` — recommendations visible; wishlist and library items absent.
4. Assign a recommended item to library — refresh — row removed from recommendations, present in library list.
5. Remove library assignments (or assign untagged catalog items) until fewer than 3 tagged library items remain; alternatively admin clears tags on catalog items.
6. Sign in as second user — different recommendations.

## Performance Considerations

MVP loads full approved catalog (≤1000 rows) and scores in memory — acceptable per PRD small scale. No caching. If catalog grows past comfortable SSR latency, a follow-up can add SQL-side tag overlap prefilter (`tags && libraryTagArray`) before app-layer ranking — out of scope for S-04.

## Migration Notes

No database migrations required. Uses existing `catalog_items.tags`, `description`, `user_assignments`, and approved-only RLS. Local testing requires S-01 approved items and S-02 library assignments.

## References

- Roadmap S-04: `context/foundation/roadmap.md`
- PRD FR-007, secondary success ≥3 tagged items: `context/foundation/prd.md`
- F-01 tags/GIN: `context/changes/catalog-schema-rls/plan.md`
- S-02 integration contract: `context/changes/catalog-search-assign/plan.md`
- Catalog service: `src/lib/services/catalog.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Pure recommendation scorer

#### Automated

- [x] 1.1 Linting passes: `npm run lint` — b3b89df
- [x] 1.2 Production build passes: `npm run build` — b3b89df
- [x] 1.3 Type checking passes via lint (type-checked ESLint rules) — b3b89df

#### Manual

- [x] 1.4 Golden scenarios A–B produce documented scorer order — b3b89df

### Phase 2: Recommendations service, API, and middleware

#### Automated

- [x] 2.1 Linting passes: `npm run lint` — fde62de
- [x] 2.2 Production build passes: `npm run build` — fde62de
- [x] 2.3 Type checking passes via lint (type-checked ESLint rules) — fde62de

#### Manual

- [x] 2.4 API returns eligible false when < 3 tagged library items — fde62de
- [x] 2.5 API returns ranked items when eligible; 401 when unauthenticated — fde62de

### Phase 3: Library UI recommendations section

#### Automated

- [x] 3.1 Linting passes: `npm run lint` — b615eaa
- [x] 3.2 Production build passes: `npm run build` — b615eaa

#### Manual

- [x] 3.3 Gate copy shown when < 3 tagged library items — b615eaa
- [x] 3.4 Recommendations list with assign actions when eligible — b615eaa
- [x] 3.5 Library and wishlist items excluded from recommendations — b615eaa

### Phase 4: Integration and golden verification

#### Automated

- [x] 4.1 Linting passes: `npm run lint` — a0cc6f6
- [x] 4.2 Production build passes: `npm run build` — a0cc6f6

#### Manual

- [x] 4.3 End-to-end assign-from-recommendation flow verified — a0cc6f6
- [x] 4.4 RLS isolation between users confirmed — a0cc6f6
- [x] 4.5 Golden scenario C exclusions verified — a0cc6f6
