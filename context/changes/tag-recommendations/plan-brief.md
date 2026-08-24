# Tag and Description Recommendations — Plan Brief

> Full plan: `context/changes/tag-recommendations/plan.md`

## What & Why

S-04 delivers FR-007: signed-in users receive ranked suggestions from the approved catalog based on tags and descriptions of items already in their library — simple overlap, not an ML engine. This closes the “what else fits my collection?” loop after S-02 lets users build a library.

## Starting Point

F-01 landed `catalog_items` (`tags text[]` + GIN, `description`), `user_assignments`, and RLS. S-01 provides admin CRUD and a static approved catalog browse. S-02 (planned) will add library/wishlist pages, assignment APIs, and assign islands — the seed data and UI host for recommendations. No recommendation service, API, or scorer exists today.

## Desired End State

On `/library`, users with **≥ 3 library items that have at least one tag** see a “Recommended for you” section (top 10, score > 0) ranked by tag overlap with a light description/title substring boost. Items already in library or wishlist never appear. Each row reuses S-02 assign actions (library / wishlist / remove). Below the gate, the section is hidden with explanatory copy. Lint + build pass; golden fixture scenarios document expected ranking.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| -------- | ------ | ---------------- | ------ |
| UI placement | Section on `/library` | Seed and suggestions live together; no new route | Plan |
| Scoring | Tags primary + light description boost | Honors FR-007 without FTS migration | Plan |
| Visibility gate | Hide until ≥ 3 tagged library items | Matches PRD secondary success bar as hard UX gate | Plan |
| Exclusions | Library + wishlist assignments | True “what else fits” — only unassigned catalog items | Plan |
| Description boost | `ILIKE`-style substring match of library tags in title/description | Reuses admin-curated tag vocabulary; simpler than tokenization | Plan |
| Result size | Top 10, score > 0 only | Scannable discovery without dumping the catalog | Plan |
| Assign CTA | Reuse S-02 `CatalogItemActions` island | End-to-end assign loop; one interaction pattern | Plan |
| Verification | Lint + build + manual + golden fixtures | Locks scorer contract without introducing a test runner | Plan |
| Wishlist as seed | No — library only | FR-007 names library tags/descriptions as input | PRD |

## Scope

**In scope:**

- Pure scorer module + recommendations service
- Optional `GET /api/recommendations` JSON API (401 JSON when unauthenticated)
- SSR recommendations section on `/library` with gate copy
- Reuse S-02 assign island on recommendation rows
- Golden fixture scenarios in plan for manual verification

**Out of scope:**

- ML / collaborative filtering / custom recommendation engine
- Wishlist as recommendation seed
- Dedicated `/recommendations` page or dashboard widget
- FTS / `tsvector` migration for description matching
- Pagination beyond top-10 cap (1000-row PostgREST cap documented)
- Share links (S-05), metadata enrichment (S-03), UI polish pass (S-06)

## Architecture / Approach

```
/library (SSR)
    │
    ├─ assignments.listForUser("library")  →  seed tags/descriptions; count tagged items (gate)
    ├─ assignments.listForUser() or state map  →  exclude assigned catalog_item_ids
    ├─ catalog.listApproved()  →  candidate pool (approved only)
    └─ recommendations.recommendForUser(...)  →  score in app layer → top 10

Optional: GET /api/recommendations  →  same service, JSON for curl/golden checks
```

Scoring: `tagScore` = count of candidate tags in library tag union; `descBoost` = +1 per library tag found as case-insensitive substring in candidate title/description when that tag is not already on candidate tags; `total = tagScore + descBoost`; sort desc, tie-break title asc.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| ----- | ---------------- | -------- |
| 1. Pure scorer | Deterministic ranking module + golden fixtures | Tie-break determinism; no S-02 dependency |
| 2. Service + API | `recommendForUser`, JSON endpoint, middleware | Requires S-02 Phase 1; substring false positives |
| 3. Library UI section | Gated recommendations block + assign islands | Requires S-02 Phase 3 (`/library`, `CatalogItemActions`) |
| 4. Integration + golden verification | End-to-end walkthrough, exclusion/gate checks | Thin catalog may yield zero matches despite passing gate |

**Prerequisites:** S-02 Phase 1 before Phase 2; S-02 Phase 3 before Phase 3. Phase 1 (scorer) can start immediately.

**Estimated effort:** ~2 sessions across 4 phases.

## Open Risks & Assumptions

- S-04 assumes S-02 contract (`listForUser`, assignment APIs, `/library`, `CatalogItemActions`) is landed — plan describes integration against that contract.
- App-layer scoring over full approved catalog is acceptable at MVP scale (≤1000 rows); no SQL ranking function.
- Short library tags may produce substring false positives in description boost (`art` in `part`) — acceptable for MVP simple overlap.
- User with ≥3 tagged library items but no positive-score candidates sees gated section with “no matches” copy.

## Success Criteria (Summary)

- User with ≥3 tagged library items sees ranked recommendations on `/library`; items in library/wishlist never appear.
- User with fewer than 3 tagged library items sees no recommendations list (gate copy only).
- Assign from a recommendation row works via S-02 island; assigned item disappears on refresh.
- Golden fixture scenarios produce documented rank order; lint and build pass.
