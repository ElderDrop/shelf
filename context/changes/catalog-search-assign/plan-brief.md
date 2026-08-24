# Catalog Search, Assign, and Library View — Plan Brief

> Full plan: `context/changes/catalog-search-assign/plan.md`

## What & Why

S-02 delivers the collector core: search the approved catalog, assign items to library or wishlist, and view/manage those collections (FR-002, FR-003, US-01). S-01 proved the approval gate with a static browse list; this slice turns catalog browsing into personal collection management. Library is a terminal list-type: once owned, an item cannot be demoted to wishlist.

## Starting Point

F-01 landed `user_assignments`, RLS (assign only to approved items, one row per user+item), and types in `src/types.ts`. S-01 added `listApproved()`, authenticated `/catalog`, admin CRUD, and JSON + Zod + service patterns. Phases 1–3 of this change landed assignment APIs, catalog search/assign UI, and `/library` / `/wishlist` pages with bidirectional move.

## Desired End State

A signed-in user searches `/catalog?q=…`, assigns to library or wishlist, and manages collections. Wishlist → library and remove remain allowed; **library → wishlist is blocked** in UI and API. Unapproved items never appear in search. Pagination stays deferred; 1000-row cap documented.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| -------- | ------ | ---------------- | ------ |
| Search semantics | Title + description + tags (ilike/exact tag) | Matches PRD discovery intent; GIN index on tags already exists | Plan |
| Search UX | SSR via `?q=` query param | Shareable URLs; fits Astro catalog page | Plan |
| Library/wishlist structure | Separate `/library` and `/wishlist` pages | Clear nav, matches FR-003 | Plan |
| Duplicate assign | Upsert list_type (with library lock) | UNIQUE(user_id, catalog_item_id); library cannot demote | Plan |
| Library list-type lock | No library → wishlist; wishlist → library OK; remove OK | Owned items stay in library unless removed | Plan |
| Lock enforcement | UI hide + service/API 403 | Prevents curl bypass | Plan |
| Pagination | Defer (document 1000-row cap) | Consistent with S-01; MVP volume is small | Plan |

## Scope

**In scope:**

- Assignment service/API, catalog search, library/wishlist pages, Topbar (Phases 1–4)
- Library → wishlist forbidden in service, API, and UI (Phase 5)

**Out of scope:**

- Pagination / FTS / recommendations / share links / metadata enrichment
- DB trigger for list-type lock (app-layer enforcement only)
- Blocking remove or wishlist → library

## Architecture / Approach

```
Browser  →  Astro pages (/catalog SSR search, /library, /wishlist)
                │
         middleware (user session; JSON 401 on /api/assignments)
                │
         /api/assignments[+ /[id]]  ← Zod →  assignments service  →  Supabase session client
                │                              listApproved(q)  ← catalog service
                └────────────────────────────────────────────────── RLS + library→wishlist guard
```

## Phases at a Glance

| Phase | What it delivers | Key risk |
| ----- | ---------------- | -------- |
| 1. Assignment service + API | Zod-validated CRUD for user assignments | Upsert vs conflict mapping; JSON 401 |
| 2. Catalog search + assign UI | `?q=` search, assign island on `/catalog` | Tag filter semantics; island hydration |
| 3. Library & wishlist pages | Collection views + move/remove + nav | Null embed when item rejected |
| 4. Integration verification | End-to-end checklist, cap docs | RLS isolation; unauthenticated routes |
| 5. Library list-type lock | Block library → wishlist (UI + API) | Upsert path must check current list_type |

**Prerequisites:** S-01 complete; local Supabase with approved catalog items.

**Estimated effort:** ~3 sessions across 5 phases (Phases 1–3 done; 4–5 remain).

## Open Risks & Assumptions

- PostgREST `max_rows` (1000) silent truncation applies to search and collection lists.
- If admin rejects an item after assign, RLS blocks UPDATE but existing assignment row may remain until user removes it — acceptable for MVP.
- Library lock is app-enforced only (no DB trigger) — acceptable for MVP single-client API.

## Success Criteria (Summary)

- User searches catalog, assigns to library, item appears on `/library` with metadata.
- Library items cannot move to wishlist (UI + 403 API); wishlist → library and remove still work.
- Unapproved items never appear in search; assign to non-approved returns 403.
- Non-authenticated visitors cannot access collector routes or assignment APIs.
