# Admin Catalog Creation and Approval — Plan Brief

> Full plan: `context/changes/admin-catalog-approval/plan.md`

## What & Why

S-01 is Shelf’s north star: the admin creates and edits catalog items and approves them so collectors can see them. Without this slice the catalog is an empty table behind RLS — F-01 proved the gate in SQL; this change proves it in the product (FR-004, FR-006).

## Starting Point

Schema, RLS, GRANTs, `is_admin()`, and `src/types.ts` already exist from F-01. The app is still the auth starter: login-only middleware on `/dashboard`, no catalog pages, no services, no Zod, shadcn Button only. Promoting an admin via Studio is currently impossible — a role-lock trigger blocks even `postgres`.

## Desired End State

An operator promotes one admin with SQL. That admin lists, creates (pending), edits, approves, and rejects items. A signed-in user browses `/catalog` and sees only approved title/description/tags. Non-admins never open `/admin`. Search and library assign stay in S-02.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| -------- | ------ | ---------------- |
| User catalog depth | Authenticated approved list, no search/assign | Proves the gate end-to-end without stealing S-02 |
| First admin | Fix trigger for `rolbypassrls`, document Studio SQL | Matches F-01; no privileged app endpoint or service-role key |
| Status workflow | Create pending; approve/reject; edit any status; re-approve rejected; no delete; cannot PATCH back to pending | Covers FR-004/FR-006; rejected stays admin-only via RLS |
| API style | JSON + Zod + `src/lib/services/` | Sets the domain API precedent CLAUDE.md already asks for |
| Testing | Manual + lint/build | AGENTS.md: no test runner unless this change introduces one |
| Admin gate | Middleware loads `profile`; 403 HTML/JSON | Users should not see a broken admin UI; RLS remains the write backstop |
| Chrome | Topbar in Layout in Phase 1; Admin link in Phase 3; Catalog link in Phase 4 | Avoids 404 nav; auth/dashboard pages inherit the bar |
| Admin list | One list, filter by status, default all | Edit/approve/reject live in one place |

## Scope

**In scope:**

- Trigger bypass so Studio can promote an admin
- Middleware: `locals.profile`, protected `/catalog` + `/admin`, JSON 401/403 on `/api/admin`
- Admin JSON APIs and catalog service
- Admin list + create/edit UI (approve/reject, no delete)
- Authenticated `/catalog` of approved items; sign-in redirects there

**Out of scope:**

- Search, assign, library/wishlist (S-02)
- Enrichment / service-role key (S-03)
- Delete UI, in-app promote, seed catalog, anonymous catalog, new test runner

## Architecture / Approach

```
Browser  →  Astro pages (/catalog SSR, /admin/* islands)
                │
         middleware (user + profile; HTML vs JSON)
                │
         /api/admin/catalog[+ /[id]]  ← Zod →  catalog service  →  Supabase session client
                                                                      │
                                                                 RLS is_admin()
```

User catalog never calls admin APIs; it uses `listApproved` on the same service. Writes always go through the signed-in admin’s JWT.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| ----- | ---------------- | -------- |
| 1. Bootstrap, middleware, chrome | Promotable admin, 403/401, Topbar links | Trigger bypass too wide, or API routes still HTML-redirect |
| 2. Service + JSON APIs | Zod-validated admin CRUD | Status/filter contract wrong before UI exists |
| 3. Admin UI | List, filter, create, edit, approve/reject | Form/API validation drift |
| 4. User catalog | Approved-only `/catalog`, post-login landing | Pending leak would fail the north star |

**Prerequisites:** F-01 applied locally (`npx supabase db reset`); two test users; Docker/Studio for the promote SQL.

**Estimated effort:** ~2–3 sessions across 4 phases.

## Open Risks & Assumptions

- Single-admin MVP: no concurrent-edit handling (last PATCH wins).
- Missing `profiles` row is treated as non-admin (fail closed).
- Production promote remains a manual SQL step after the migration is applied.
- PostgREST `max_rows` (1000) is enough; no pagination.

## Success Criteria (Summary)

- Admin can create an item, approve it, and a non-admin sees it on `/catalog`.
- Pending and rejected items never appear on `/catalog`.
- Non-admins cannot use `/admin` or `/api/admin` (403); signed-out visitors are asked to sign in.
