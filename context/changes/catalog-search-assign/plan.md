# Catalog Search, Assign, and Library View Implementation Plan

## Overview

Extend Shelf's collector path so signed-in users can search the approved catalog, assign items to library or wishlist, and view/manage those collections. Builds on F-01 (`user_assignments` + RLS) and S-01 (static `/catalog`, service/API patterns). No new migrations expected.

## Current State Analysis

F-01 and S-01 are complete. The data layer supports assignments; the app layer does not.

### Key Discoveries:

- `user_assignments` table with `UNIQUE(user_id, catalog_item_id)` and `list_type` enum (`library` | `wishlist`) — RLS allows INSERT only for approved catalog items and UPDATE of `list_type` on own rows (`supabase/migrations/20260608130000_catalog_rls.sql:52-92`).
- `UserAssignment` and `ListType` exist in `src/types.ts:3-28` but are unused in application code.
- `/catalog` lists all approved items via `listApproved(supabase)` with no search or actions (`src/pages/catalog.astro`, `src/lib/services/catalog.ts:54-67`).
- Only admin JSON APIs exist under `/api/admin/*`; user mutations have no API yet (`src/pages/api/admin/catalog.ts` is the pattern to follow).
- Middleware protects `/dashboard`, `/catalog`, `/admin` but not `/library`, `/wishlist`, or user APIs (`src/middleware.ts:4`).
- Topbar has Catalog and Dashboard only — no Library/Wishlist links (`src/components/Topbar.astro:13-18`).
- GIN index on `catalog_items.tags` supports tag overlap queries; no FTS migration (`supabase/migrations/20260608120000_catalog_schema.sql`).
- PostgREST `max_rows` default 1000 — lists truncate silently (`src/lib/services/catalog.ts:54`, `README.md:174`).

## Desired End State

After this plan completes:

1. User opens `/catalog`, enters a search query, and sees only **approved** items matching title, description, or tags.
2. User assigns an item to library or wishlist from catalog; if already assigned, can move between lists or remove.
3. User opens `/library` and `/wishlist` and sees assigned items with title, description, and tags; can move or remove from each page.
4. Unauthenticated access to `/catalog`, `/library`, `/wishlist`, and `/api/assignments` is blocked (HTML redirect or JSON 401).
5. Assigning a non-approved catalog item fails cleanly (RLS → 403).

**Verification:** lint + build pass; human walks search → assign → view library → move to wishlist → remove.

## What We're NOT Doing

- Pagination or truncated-list UI (deferred from S-01; document cap only).
- FTS / `tsvector` migration or ranked search.
- Tag recommendations (S-04), read-only share links (S-05), metadata enrichment (S-03).
- Per-item detail pages (`/catalog/[id]`), bulk assign, import/export.
- Public/anonymous catalog, service-role Supabase client, new test runner.
- UI polish pass (S-06) — functional surfaces only, consistent with current zinc palette.

## Implementation Approach

Four phases: assignment contract first (service + API), then catalog search + assign UI, then collection pages + nav, then integration verification. Search stays SSR; interactive assign/move/remove uses React islands + fetch, mirroring S-01 admin list pattern.

Queries use session client + RLS. Assignment POST implements upsert semantics: insert new row, or on unique violation update `list_type`.

## Critical Implementation Details

**Middleware must return JSON 401 for `/api/assignments`.** Same rule as `/api/admin/*`: unauthenticated `fetch` must not receive an HTML redirect to sign-in. Add a user-API prefix check before the generic protected-route redirect.

**Search empty query = full approved list.** Treat missing or blank `q` the same as today's `/catalog` behavior.

**Tag search uses exact element match, not substring.** For query `q` (trimmed, non-empty): match if `title ILIKE %q%` OR `description ILIKE %q%` OR `tags` array **contains the exact element** `q` via PostgREST `tags.cs.{q}` (case-sensitive — tags are stored as entered by admin). This is not substring tag search (`fan` will not match tag `fantasy`). Escape `%`, `_`, commas, and parentheses in `q` before building the `.or()` filter string. Document the exact filter in `listApproved` JSDoc.

**Rejected items after assign.** If admin later rejects an approved item, the assignment row may remain; user cannot UPDATE it (RLS requires approved target). Remove still works. Do not add cascade delete in this slice.

## Phase 1: Assignment service and JSON API

### Overview

Introduce the assignment domain layer and authenticated JSON API. No UI yet — verifiable via curl/fetch.

### Changes Required:

#### 1. Assignment Zod schemas

**File**: `src/lib/schemas/assignment.ts`

**Intent**: Validate assignment API payloads and query params.

**Contract**: `assignmentCreateSchema` — `{ catalog_item_id: uuid, list_type: "library" | "wishlist" }`. `assignmentUpdateSchema` — `{ list_type: "library" | "wishlist" }`. `assignmentListFilterSchema` — optional `list_type` enum for GET filter.

#### 2. Assignment service

**File**: `src/lib/services/assignments.ts`

**Intent**: Encapsulate assignment queries and mutations with typed errors, mirroring `catalog.ts`.

**Contract**:

- `AssignmentServiceError` with codes `not_found | forbidden | conflict | unknown`.
- `AssignmentWithItem` type: assignment fields plus nested `catalog_item: { title, description, tags }` (nullable-safe mapping).
- `listForUser(client, listType?: ListType): Promise<AssignmentWithItem[]>` — select from `user_assignments` with embed `catalog_items(title, description, tags)`, filter by `list_type` when provided, order by `created_at` desc. Map PostgREST embed key `catalog_items` → app field `catalog_item` (nullable when RLS hides rejected rows).
- `listAssignmentStateForCatalog(client, catalogItemIds: string[]): Promise<Map<catalogItemId, ListType>>` — lightweight lookup for catalog UI (own assignments only).
- `assign(client, catalogItemId, listType): Promise<UserAssignment>` — INSERT; on Postgres `23505` (unique violation), UPDATE `list_type` WHERE `catalog_item_id = catalogItemId` (RLS scopes to own row — caller may not have assignment id yet). Map rejected-target UPDATE failure to `403`.
- `updateListType(client, assignmentId, listType): Promise<UserAssignment>` — PATCH own row.
- `remove(client, assignmentId): Promise<void>` — DELETE own row.
- Map PostgREST `42501` → forbidden, `PGRST116` → not_found, assign to non-approved → forbidden.

#### 3. Assignment collection API

**File**: `src/pages/api/assignments.ts`

**Intent**: List and create assignments for the signed-in user.

**Contract**: Export `prerender = false`. `GET` — optional `?list_type=library|wishlist`, returns `{ data: AssignmentWithItem[] }`. `POST` — body validated by `assignmentCreateSchema`, returns `{ data: UserAssignment }` with 201 on insert, 200 on upsert-update. Unauthenticated → 401 JSON. Uses `jsonOk` / `jsonError` from `src/lib/api-response.ts`.

#### 4. Assignment item API

**File**: `src/pages/api/assignments/[id].ts`

**Intent**: Update or delete a single assignment by id.

**Contract**: `PATCH` — `assignmentUpdateSchema`, returns updated assignment. `DELETE` — 204 or `{ data: null }`. 404 when row not found or not owned. Unauthenticated → 401 JSON.

#### 5. Middleware: protect collection routes and user APIs

**File**: `src/middleware.ts`

**Intent**: Require auth for library/wishlist pages and assignment APIs with correct HTML vs JSON behavior.

**Contract**:

- Add `/library`, `/wishlist` to `PROTECTED_ROUTES`.
- Add helper `isApiAssignments(pathname)` for `/api/assignments` prefix.
- Unauthenticated + assignment API → `401` JSON `{ "error": "Unauthorized" }` (before generic redirect).
- Authenticated users pass through; RLS scopes data.

### Success Criteria:

#### Automated Verification:

- Linting passes: `npm run lint`
- Production build passes: `npm run build`
- Type checking passes via lint (type-checked ESLint rules)

#### Manual Verification:

- Authenticated `GET /api/assignments` returns empty array initially
- Authenticated `POST /api/assignments` with valid approved `catalog_item_id` creates row; repeat POST with different `list_type` updates same row
- Unauthenticated `GET /api/assignments` returns 401 JSON (not HTML redirect)
- POST with pending/rejected item id returns 403

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Catalog search and assign UI

### Overview

Add SSR search to `/catalog` and a React island for assign/move/remove actions with current assignment state.

### Changes Required:

#### 1. Extend catalog search in service

**File**: `src/lib/services/catalog.ts`

**Intent**: Filter approved items by optional search query.

**Contract**: Change signature to `listApproved(client, query?: string): Promise<CatalogItem[]>`. When `query` is non-empty after trim, apply filter: title/description ilike `%query%` (escape `%`/`_`) OR exact tag element via `tags.cs.{query}` (escape commas/parens in query). Always `.eq("status", "approved")`. Preserve `updated_at` desc ordering and 1000-row cap JSDoc. Document exact-match tag semantics in JSDoc.

#### 2. Catalog page search + assignment bootstrap

**File**: `src/pages/catalog.astro`

**Intent**: SSR search results and pass initial assignment state to the interactive island.

**Contract**:

- Read `q` from `Astro.url.searchParams`, pass to `listApproved(supabase, q)`.
- Render GET search form (`<input name="q">`, submit refreshes page).
- For each catalog row, render a `CatalogItemActions` island (`client:load`) with props `catalogItemId` and optional `listType` (from `listAssignmentStateForCatalog` for visible item ids).
- Preserve empty-state copy when no results vs no approved items.

#### 3. Catalog item actions island

**File**: `src/components/catalog/CatalogItemActions.tsx`

**Intent**: Per-row assign, move, and remove buttons on the catalog page.

**Contract**:

- Props: `catalogItemId`, optional current `listType`.
- Show "Add to library" / "Add to wishlist" when unassigned; when assigned show badge + "Move to …" + "Remove".
- Calls `POST /api/assignments`, `PATCH /api/assignments/[id]`, `DELETE /api/assignments/[id]` via fetch; optimistic or reload-on-success (prefer reload for simplicity).
- Use shadcn `Button` / `Badge` for consistency with admin UI.
- Handle API errors with inline message or alert.

#### 4. Optional: catalog assignment state hook

**File**: `src/components/hooks/useAssignmentActions.ts`

**Intent**: Share fetch/error/loading logic between catalog and collection islands.

**Contract**: Hook exposing `assign`, `move`, `remove` functions wrapping assignment APIs; consumed by Phase 2 and 3 components.

### Success Criteria:

#### Automated Verification:

- Linting passes: `npm run lint`
- Production build passes: `npm run build`

#### Manual Verification:

- `/catalog?q=term` shows only matching approved items; blank `q` shows full list
- Assign from catalog → item shows assigned state on page refresh
- Move library → wishlist from catalog updates state
- Remove from catalog clears assigned state
- Pending items never appear in search results

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Library and wishlist pages

### Overview

Dedicated collection views with move/remove actions and Topbar navigation.

### Changes Required:

#### 1. Library page

**File**: `src/pages/library.astro`

**Intent**: Show user's library assignments with catalog metadata.

**Contract**: SSR via `listForUser(supabase, "library")`. Render list of title, description, tags (from embedded catalog item). When embedded `catalog_item` is null (admin rejected or item hidden by RLS), show copy "This item is no longer available in the catalog" and offer Remove only — no Move. Empty state when no items. Hydrate `CollectionItemActions` island per row.

#### 2. Wishlist page

**File**: `src/pages/wishlist.astro`

**Intent**: Same as library for wishlist list type.

**Contract**: Mirror `library.astro` with `list_type: "wishlist"`. Same null-embed handling when `catalog_item` is null.

#### 3. Collection item actions island

**File**: `src/components/collection/CollectionItemActions.tsx`

**Intent**: Move to other list and remove from collection pages.

**Contract**: Props: `assignmentId`, `catalogItemId`, current `listType`. Buttons: "Move to library" / "Move to wishlist" (show opposite list), "Remove". Reuse `useAssignmentActions` hook. On success, reload page or remove row from DOM.

#### 4. Topbar navigation

**File**: `src/components/Topbar.astro`

**Intent**: Expose library and wishlist in global nav for signed-in users.

**Contract**: Add links to `/library` and `/wishlist` between Catalog and Dashboard for authenticated users.

#### 5. README route documentation

**File**: `README.md`

**Intent**: Document new user-facing routes and assignment flow for operators/testers.

**Contract**: Add `/library`, `/wishlist`, `/api/assignments` to auth/routes table if present; note 1000-row cap applies to search and collections.

### Success Criteria:

#### Automated Verification:

- Linting passes: `npm run lint`
- Production build passes: `npm run build`

#### Manual Verification:

- `/library` shows items assigned to library with title, description, tags
- `/wishlist` shows wishlist items only
- Move from library page → item disappears from library, appears on wishlist
- Remove from collection page clears item from that list
- Topbar links work for signed-in user

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Integration verification

### Overview

End-to-end validation, documentation touch-ups, and cap reminder — no new features.

### Changes Required:

#### 1. Service JSDoc cap reminder

**File**: `src/lib/services/assignments.ts`

**Intent**: Document PostgREST row cap on collection queries same as catalog service.

**Contract**: JSDoc on `listForUser` noting silent truncation at `max_rows` (default 1000).

#### 2. Human verification checklist

**File**: `context/changes/catalog-search-assign/plan.md` (Progress section)

**Intent**: Track closure of full US-01 / FR-002 / FR-003 walkthrough.

**Contract**: Manual steps covered in Progress Phase 4.

### Success Criteria:

#### Automated Verification:

- Linting passes: `npm run lint`
- Production build passes: `npm run build`

#### Manual Verification:

- Full flow: admin-approved item → user searches → assigns to library → views library → moves to wishlist → removes
- Second user cannot see first user's assignments (RLS isolation)
- Sign-out blocks access to catalog, library, wishlist

---

## Testing Strategy

### Unit Tests:

- None — AGENTS.md: no test runner unless this change introduces one. Verification is lint + build + manual checklist.

### Integration Tests:

- Manual API checks in Phase 1 (curl or browser fetch)
- End-to-end collector flow in Phase 4

### Manual Testing Steps:

1. Seed at least two approved catalog items with distinct titles/tags (via admin UI).
2. Sign in as user A; search `/catalog?q=<tag>` — verify filter works.
3. Assign item to library; confirm on `/library`.
4. Move to wishlist from library page; confirm on `/wishlist`.
5. Remove from wishlist; confirm gone from both pages.
6. Sign in as user B; confirm user A's collections are not visible.
7. Attempt assign to pending item via API — expect 403.

## Performance Considerations

MVP catalog size is small (PRD target scale). SSR search with ilike + tag filter on ≤1000 rows is acceptable. No caching layer. Assignment state lookup for catalog page is one query for all visible item ids.

## Migration Notes

No database migrations required. Existing RLS and UNIQUE constraint support all assignment operations. If local DB lacks approved items, use S-01 admin flow to create and approve test data.

## References

- Roadmap S-02: `context/foundation/roadmap.md`
- PRD US-01, FR-002, FR-003: `context/foundation/prd.md`
- F-01 schema/RLS: `context/changes/catalog-schema-rls/plan.md`
- S-01 patterns: `context/changes/admin-catalog-approval/plan.md`
- Catalog service: `src/lib/services/catalog.ts`
- RLS policies: `supabase/migrations/20260608130000_catalog_rls.sql`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Assignment service and JSON API

#### Automated

- [x] 1.1 Linting passes: `npm run lint` — e0e06ec
- [x] 1.2 Production build passes: `npm run build` — e0e06ec
- [x] 1.3 Type checking passes via lint (type-checked ESLint rules) — e0e06ec

#### Manual

- [x] 1.4 Authenticated GET/POST assignment API works; upsert move on duplicate — e0e06ec
- [x] 1.5 Unauthenticated assignment API returns 401 JSON — e0e06ec
- [x] 1.6 Assign to pending/rejected item returns 403 — e0e06ec

### Phase 2: Catalog search and assign UI

#### Automated

- [x] 2.1 Linting passes: `npm run lint` — b9120a4
- [x] 2.2 Production build passes: `npm run build` — b9120a4

#### Manual

- [x] 2.3 SSR search via `?q=` filters approved items — b9120a4
- [x] 2.4 Assign, move, and remove from catalog page work — b9120a4
- [x] 2.5 Pending items never appear in search — b9120a4

### Phase 3: Library and wishlist pages

#### Automated

- [x] 3.1 Linting passes: `npm run lint`
- [x] 3.2 Production build passes: `npm run build`

#### Manual

- [x] 3.3 Library and wishlist pages show assigned items with metadata
- [x] 3.4 Move and remove work from collection pages
- [x] 3.5 Topbar links navigate correctly

### Phase 4: Integration verification

#### Automated

- [ ] 4.1 Linting passes: `npm run lint`
- [ ] 4.2 Production build passes: `npm run build`

#### Manual

- [ ] 4.3 Full US-01 / FR-002 / FR-003 flow verified end-to-end
- [ ] 4.4 RLS isolation between users confirmed
- [ ] 4.5 Unauthenticated access blocked on all collector routes
