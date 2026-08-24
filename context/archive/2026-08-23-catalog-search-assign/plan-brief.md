# Catalog Search, Assign, and Library View — Plan Brief

> Full plan: `context/changes/catalog-search-assign/plan.md`

## What & Why

S-02 delivers the collector core: search the approved catalog, assign items to library or wishlist, and view/manage those collections (FR-002, FR-003, US-01). S-01 proved the approval gate with a static browse list; this slice turns catalog browsing into personal collection management.

## Starting Point

F-01 landed `user_assignments`, RLS (assign only to approved items, one row per user+item), and types in `src/types.ts`. S-01 added `listApproved()`, authenticated `/catalog` (full list, no search), admin CRUD, and JSON + Zod + service patterns — but no assignment service, user APIs, or library/wishlist pages.

## Desired End State

A signed-in user searches `/catalog?q=…` (title, description, tags), assigns items to library or wishlist from catalog rows, moves items between lists, and removes them. `/library` and `/wishlist` show assigned items with title, description, and tags, with move/remove actions. Unapproved items never appear in search. Pagination stays deferred; 1000-row cap documented.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| -------- | ------ | ---------------- | ------ |
| Search semantics | Title + description + tags (ilike/overlap) | Matches PRD discovery intent; GIN index on tags already exists | Plan |
| Search UX | SSR via `?q=` query param | Shareable URLs, no JS required for search; fits current Astro catalog page | Plan |
| Library/wishlist structure | Separate `/library` and `/wishlist` pages | Clear nav, matches FR-003 literally | Plan |
| Assign UX | Buttons on `/catalog` rows (React island) | One-stop search-and-assign per US-01 | Plan |
| Duplicate assign | Upsert — move library ↔ wishlist | Matches UNIQUE(user_id, catalog_item_id) and RLS UPDATE policy | Plan |
| Remove | Allow remove from collection | Basic collection hygiene and undo | Plan |
| Collection page actions | Move and remove on library/wishlist too | Full collection management without returning to catalog | Plan |
| Pagination | Defer (document 1000-row cap) | Consistent with S-01; MVP volume is small | Plan |

## Scope

**In scope:**

- Extend `listApproved(client, q?)` for search
- Assignment service, Zod schemas, `/api/assignments` JSON API
- Middleware: protect `/library`, `/wishlist`, `/api/assignments`
- `/catalog` search form + assign/move/remove island
- `/library` and `/wishlist` pages with move/remove
- Topbar links for Library and Wishlist

**Out of scope:**

- Pagination or truncated-list flag (S-06 or follow-up)
- FTS migration / tsvector indexes
- Recommendations (S-04), share links (S-05), metadata enrichment (S-03)
- Public/anonymous catalog, service-role client, new test runner
- Item detail pages, bulk assign, import/export

## Architecture / Approach

```
Browser  →  Astro pages (/catalog SSR search, /library, /wishlist)
                │
         middleware (user session; JSON 401 on /api/assignments)
                │
         /api/assignments[+ /[id]]  ← Zod →  assignments service  →  Supabase session client
                │                              listApproved(q)  ← catalog service
                └────────────────────────────────────────────────── RLS (approved-only assign)
```

Catalog search stays SSR; assign/move/remove use fetch against user APIs. RLS enforces approved-only inserts and own-row access.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| ----- | ---------------- | -------- |
| 1. Assignment service + API | Zod-validated CRUD for user assignments | Upsert vs conflict mapping; JSON 401 on unauthenticated API |
| 2. Catalog search + assign UI | `?q=` search, assign island on `/catalog` | Search filter semantics for tags; island hydration with assignment state |
| 3. Library & wishlist pages | Collection views + move/remove + nav | Join query shape; rejected/unapproved items after admin action |
| 4. Integration verification | End-to-end checklist, cap docs | Edge cases: assign pending item (403), empty search |

**Prerequisites:** S-01 complete; local Supabase with approved catalog items; two test users optional.

**Estimated effort:** ~2–3 sessions across 4 phases.

## Open Risks & Assumptions

- PostgREST `max_rows` (1000) silent truncation applies to search and collection lists.
- If admin rejects an item after assign, RLS blocks UPDATE but existing assignment row may remain until user removes it — acceptable for MVP.
- No concurrent-edit handling on assignments (last write wins).
- Single search box; no advanced filters (status, date, multi-tag AND).

## Success Criteria (Summary)

- User searches catalog, assigns to library, item appears on `/library` with title/description/tags.
- Same item can move library ↔ wishlist; remove clears it from both views.
- Unapproved items never appear in search results; assign to non-approved item returns 403/404.
- Non-authenticated visitors cannot access catalog, library, wishlist, or assignment APIs.
