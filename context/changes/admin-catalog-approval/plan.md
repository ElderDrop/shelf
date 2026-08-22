# Admin Catalog Creation and Approval Implementation Plan

## Overview

Give the single admin a way to create, edit, approve, and reject catalog items, and give signed-in users a browse-only list of **approved** items. This is the S-01 north star: the approval gate becomes a real product flow, not just RLS.

## Current State Analysis

F-01 (`catalog-schema-rls`, status `impl_reviewed`) already landed the data layer: `catalog_items` (`pending` / `approved` / `rejected`), `profiles.role`, `is_admin()`, RLS, GRANTs to `authenticated` (not `anon`), and `src/types.ts`. App code still treats Shelf as an auth starter.

### Key Discoveries:

- Catalog writes can use the existing anon-key session client — RLS `is_admin()` is the write gate (`supabase/migrations/20260608130000_catalog_rls.sql:33-50`). No service-role client exists or is needed.
- Middleware only protects `/dashboard` and never loads `profiles` (`src/middleware.ts:4-21`). `App.Locals` has `user` only (`src/env.d.ts:1-5`).
- Signups always get `role = 'user'`. Promoting an admin is a Studio SQL `UPDATE`, but `profiles_prevent_role_change` currently raises on **any** role change — including `postgres` (`supabase/migrations/20260608150000_profiles_role_immutable.sql:4-19`). The documented promote path is broken until this slice fixes the trigger.
- There are no catalog pages, no `src/lib/services/`, no Zod in app code, and only shadcn `Button`. Auth APIs are HTML form POST + redirect (`src/pages/api/auth/signin.ts`). This slice introduces the JSON + Zod + service pattern CLAUDE.md already describes.
- Approved catalog is **not** public: no GRANTs or RLS policies for `anon` (`supabase/migrations/20260608140000_catalog_grants.sql:4-12`). The user-facing catalog must be an authenticated route.
- Layout has no nav; `Topbar.astro` is homepage-only (`src/layouts/Layout.astro:38`, `src/components/Welcome.astro`).
- No test runner; AGENTS.md forbids adding one unless this change introduces a framework. Verification is lint + build + a human checklist.

## Desired End State

After this plan completes:

1. An operator can promote the first admin with a documented SQL statement run as `postgres` (Studio).
2. Signed-in **admins** can list all catalog items (filter by status), create items (always `pending`), edit title/description/tags in any status, and set status to `approved` or `rejected`. There is no delete UI.
3. Signed-in **users** see `/catalog`: title, description, and tags of **approved** items only. Pending and rejected items never appear.
4. Non-admins hitting `/admin` or `/api/admin` get 403. Unauthenticated visitors of those routes (and `/catalog`) are sent to sign-in (HTML) or 401 (JSON APIs).
5. Shared chrome: Layout always shows Topbar. Signed-in users get Catalog; admins also get Admin.
6. Domain mutations go through Zod-validated JSON APIs and `src/lib/services/catalog.ts`, with RLS as the backstop.

**Verification:** lint + build pass; a human walks create → approve → user sees item, and create → leave pending → user does not see it.

## What We're NOT Doing

- Catalog search, assign to library/wishlist, or library/wishlist views (S-02).
- Automated metadata enrichment or `SUPABASE_SERVICE_ROLE_KEY` (S-03).
- Delete-item UI, un-approve-to-`pending`, or an in-app “promote to admin” API.
- Seed catalog rows or a default admin email in `seed.sql`.
- Public/anonymous catalog. JWT custom access-token claims.
- Introducing Vitest, Playwright, or any other test runner.
- Rewriting auth forms onto the JSON API pattern (leave POST + redirect).

## Implementation Approach

Four phases, each a reviewable vertical: first make admin *possible* (trigger + middleware + nav), then the mutation contract (service + APIs), then the admin UI on that contract, then the user-facing proof of the approval gate.

Queries and mutations always use `createClient` from `src/lib/supabase.ts` (user session). Handlers check `locals.profile.role === 'admin'` for UX/403; Postgres RLS still rejects non-admin writes if a route is missed.

## Critical Implementation Details

**Admin promote is blocked today.** `prevent_profile_role_change` fires for every role, including Studio `postgres`. Phase 1 must skip the raise when `current_user` has `rolbypassrls` (true for `postgres`, `supabase_admin`, `service_role`) and keep blocking `authenticated`. Do not `DISABLE TRIGGER` as the documented promote path.

Keep the function **SECURITY INVOKER** (the default). Do not copy `SECURITY DEFINER` from `is_admin()` / `handle_new_user()` — under DEFINER, `current_user` is the owner and every client could change `role`. Use `current_user`, not `session_user`: after `SET LOCAL ROLE authenticated`, `session_user` is still `postgres` and would wrongly allow the change.

**Middleware must split HTML vs JSON.** Unauthenticated `/admin` and `/catalog` redirect to `/auth/signin`. Unauthenticated `/api/admin/*` must return `401` JSON — a redirect would send `fetch` to an HTML login page. Non-admin `/admin` → HTTP **403** HTML (not a 302); non-admin `/api/admin/*` → `403` JSON. Treat both `/admin` and `/api/admin` as admin prefixes.

**`403.astro` is not a special status route.** Astro only auto-statuses `/404` and `/500`. To keep `/admin` in the URL and still send 403: `const page = await context.rewrite("/403"); return new Response(page.body, { status: 403, headers: page.headers })`. Also set `Astro.response.status = 403` in the page frontmatter. Do not `redirect("/403")` (that is a 302). Rewrite re-runs middleware; `/403` is not an admin prefix, so it will not loop.

**Fail closed on a missing profile.** If `auth.getUser()` succeeds but `profiles` has no row, the user is not an admin. Do not invent a default role.

## Phase 1: Admin bootstrap, middleware, and chrome

### Overview

Make the first admin promotable, attach `profile` to every request, protect catalog/admin routes, and put session chrome in Layout. Catalog / Admin nav links wait until those pages exist (Phases 3–4).

### Changes Required:

#### 1. Role-change trigger bypass

**File**: `supabase/migrations/20260817120000_profiles_role_bypass_rls.sql`

**Intent**: Let Studio/`postgres` (and `service_role`) promote an admin while still blocking self-promotion from the anon-key client.

**Contract**: Replace `prevent_profile_role_change` so a role change is allowed only when `pg_roles.rolbypassrls` is true for `current_user`. All other callers still `RAISE EXCEPTION 'profiles.role cannot be changed'`. Function stays **SECURITY INVOKER** (do not add `DEFINER`). RLS `profiles_update_own` stays as-is.

```sql
IF EXISTS (
  SELECT 1 FROM pg_roles
  WHERE rolname = current_user AND rolbypassrls
) THEN
  RETURN NEW;
END IF;
```

#### 2. Document admin promote

**File**: `README.md`

**Intent**: Give operators a copy-paste promote path that actually works after the trigger fix.

**Contract**: Add a short “First admin” subsection under Supabase Configuration. Instruct: open Studio SQL as postgres, look up `auth.users.id` by email, `UPDATE public.profiles SET role = 'admin' WHERE id = '…'`. Note that this must run as postgres (not as the signed-in user). Update the auth-routes table only if the new routes already exist; otherwise defer the route table to Phase 4.

#### 3. Load profile and enforce route classes

**File**: `src/middleware.ts`

**Intent**: Resolve `profiles` for the signed-in user once per request and enforce login vs admin vs API vs HTML.

**Contract**:

- After `locals.user` is set, if a user exists, `SELECT` their `profiles` row onto `locals.profile` (`Profile | null`).
- `PROTECTED_ROUTES`: `/dashboard`, `/catalog`, `/admin` (prefix match, same as today).
- Admin prefixes: `/admin` and `/api/admin`.
- Unauthenticated + protected HTML → redirect `/auth/signin`. Unauthenticated + `/api/admin` → `401` JSON `{ "error": "Unauthorized" }`.
- Authenticated non-admin + `/admin` → rewrite `/403` and return that body with **status 403** (see Critical Implementation Details). Authenticated non-admin + `/api/admin` → `403` JSON `{ "error": "Forbidden" }`.
- `/api/auth/*` stays public. `/403` is public (no login required) so rewrite does not loop.

#### 4. Locals typing

**File**: `src/env.d.ts`

**Intent**: Make `profile` available to Astro pages and API routes without a second query.

**Contract**: `Locals.profile: import("@/types").Profile | null` alongside existing `user`.

#### 5. Forbidden page

**File**: `src/pages/403.astro`

**Intent**: Signed-in non-admins hitting `/admin` get a real page, not an empty 500.

**Contract**: Renders inside `Layout`. Explains the page is admin-only and links to `/dashboard` (the `/catalog` link is added in Phase 4). Frontmatter sets `Astro.response.status = 403`. Direct visits to `/403` also send 403. Middleware must **rewrite** this page for `/admin` (not redirect) and wrap the rewrite `Response` so the client sees status 403 while the URL stays `/admin/...`.

#### 6. Shared Topbar in Layout

**Files**: `src/layouts/Layout.astro`, `src/components/Topbar.astro`

**Intent**: Every Layout page shows session chrome without duplicating Topbar or linking to routes that do not exist yet.

**Contract**: Layout renders `Topbar` above the slot (keep the missing-config Banner). This affects every Layout consumer: `/`, `/dashboard`, `/auth/signin`, `/auth/signup`, `/auth/confirm-email`, and later catalog/admin pages. Topbar sits **outside** page-level `bg-cosmic` wrappers — keep its styles readable on both the cosmic pages and the default body background (a full-width bar with its own background, not white-on-transparent). Topbar uses `Astro.locals.user` (profile is available but **do not add Catalog or Admin hrefs in this phase**). Signed-in: email, Dashboard (`/dashboard`), sign-out form. Signed-out: Sign in / Sign up. Remove the duplicate Topbar include from `Welcome.astro`. Dashboard may keep its in-page sign-out; that duplication is acceptable until a later cleanup.

### Success Criteria:

#### Automated Verification:

- Migration file exists at `supabase/migrations/20260817120000_profiles_role_bypass_rls.sql`
- `npm run lint` passes
- `npm run build` passes

#### Manual Verification:

- `npx supabase db reset` applies the new migration without errors
- In Studio SQL as postgres: `UPDATE profiles SET role = 'admin'` for a real user succeeds
- As that user via the app (or SQL `SET ROLE authenticated`): `UPDATE profiles SET role = 'admin'` on their own row still fails
- Signed-out visit to `/catalog` or `/admin/catalog` redirects to `/auth/signin`
- Signed-in non-admin visit to `/admin/catalog` returns 403 (not a redirect to catalog)
- Signed-out `fetch` to `/api/admin/catalog` returns 401 JSON (not an HTML redirect)
- Signed-in non-admin `fetch` to `/api/admin/catalog` returns 403 JSON
- Topbar appears once on Layout pages including sign-in, confirm-email, and dashboard; Welcome does not render a second Topbar; Catalog and Admin links are absent

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Catalog service and admin JSON APIs

### Overview

Add Zod as a direct dependency, extract catalog CRUD into a service, and expose admin JSON endpoints. No admin UI yet — verify with `fetch` / curl while signed in as admin vs user.

### Changes Required:

#### 1. Zod dependency

**File**: `package.json`

**Intent**: Follow the documented API convention (`CLAUDE.md` / `AGENTS.md`) for the first domain endpoints.

**Contract**: Add `zod` as a direct dependency (current stable 3.x unless the lockfile already pulls 4 via Astro — match that major). Do not add react-hook-form unless a later phase needs it.

#### 2. JSON error helper

**File**: `src/lib/api-response.ts`

**Intent**: One error/success shape so admin UI and curl checks stay consistent.

**Contract**: JSON body `{ "error": string, "details"?: { "field": string, "message": string }[] }` for failures. Status codes: `400` validation, `401` unauthenticated, `403` not admin, `404` missing item, `500` unexpected. Success: `200`/`201` with `{ "data": … }`.

#### 3. Catalog service

**File**: `src/lib/services/catalog.ts`

**Intent**: All `catalog_items` reads/writes go through one module so pages and API routes do not inline Supabase queries.

**Contract**: Functions take a Supabase client (session) plus typed input. At minimum: `listApproved`, `listAll` (optional `status` filter), `getById`, `create` (status forced to `pending`), `update` (title, description, tags, and/or status `approved`|`rejected` — never `pending`). Map PostgREST errors to a small typed failure the API layer can turn into 403/404/500. Do not query `user_assignments`.

#### 4. Create/update schemas

**File**: `src/lib/schemas/catalog.ts` (or colocated with the service)

**Intent**: Shared validation for POST/PATCH so the React form and the API cannot drift.

**Contract**:

- `title`: trimmed string, 1–200 chars
- `description`: optional string, max 5000; empty string stored as `null`
- `tags`: array of 0–20 unique trimmed strings, each 1–50 chars (API accepts `string[]`; the form may send a comma-separated string that the handler splits)
- `status` (PATCH only): `approved` | `rejected` only — cannot set `pending`. New rows become `pending` exclusively via POST.
- POST ignores client `status` and always inserts `pending`

#### 5. Admin collection API

**File**: `src/pages/api/admin/catalog.ts`

**Intent**: List and create catalog items for the admin UI.

**Contract**: `export const prerender = false`. `GET` → `listAll` with optional `?status=`; `POST` → parse JSON, Zod-validate, `create`. Defense in depth: if `locals.profile?.role !== 'admin'`, return 403 even though middleware already checked. `GET`/`POST` only.

#### 6. Admin item API

**File**: `src/pages/api/admin/catalog/[id].ts`

**Intent**: Read and update a single item, including approve/reject via `status`.

**Contract**: `prerender = false`. `GET` → one item or 404. `PATCH` → partial update of title/description/tags and/or status (`approved` or `rejected` only; `pending` is 400). Invalid UUID → 400. No `DELETE` handler.

### Success Criteria:

#### Automated Verification:

- `zod` is listed in `package.json` dependencies
- `npm run lint` passes
- `npm run build` passes

#### Manual Verification:

- As admin: `POST /api/admin/catalog` with `{ "title": "Test", "description": "…", "tags": ["manga"] }` returns 201 and `status: "pending"`
- As admin: `PATCH` that item `{ "status": "approved" }` then `{ "title": "Renamed" }` both succeed
- As admin: `GET /api/admin/catalog` returns the item; `GET /api/admin/catalog?status=pending` excludes it after approval
- As non-admin: `POST` / `GET` / `PATCH` return 403; the pending row is not visible via the user session’s `catalog_items` select (RLS)
- Invalid body (empty title, too many tags) returns 400 with `details[].field`

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Admin catalog UI

### Overview

Build the admin list (all statuses, filterable) and create/edit form as React islands on the JSON APIs. Approve and reject are first-class actions; there is no delete control.

### Changes Required:

#### 1. shadcn primitives

**Files**: `src/components/ui/*` via `npx shadcn@latest add`

**Intent**: Reuse new-york components instead of extending the cosmic auth `FormField`.

**Contract**: Add at least `input`, `label`, `textarea`, `badge`, `card`, `table`, `select`. Do not add Dialog (no delete confirm). Keep `Button`.

#### 2. Admin list page

**Files**: `src/pages/admin/catalog.astro`, `src/components/admin/CatalogList.tsx`

**Intent**: One screen for the whole catalog so the admin can filter, open an item, and approve/reject without hunting URLs.

**Contract**: Route `/admin/catalog` (protected by middleware). Island receives the initial list as props (SSR via `listAll`) and refreshes via `GET /api/admin/catalog?status=`. Filter control: All / Pending / Approved / Rejected; default All. Pending rows are visually distinct (badge). Row actions: Edit (link to `/admin/catalog/[id]`), Approve, Reject (`PATCH` status). Empty state when there are no items for the current filter. Link to `/admin/catalog/new`. Add an Admin link (`/admin/catalog`) to Topbar, visible only when `profile.role === 'admin'`.

#### 3. Create and edit form

**Files**: `src/pages/admin/catalog/new.astro`, `src/pages/admin/catalog/[id].astro`, `src/components/admin/CatalogForm.tsx`

**Intent**: Admin can enter title, description, and tags, and change status on an existing item.

**Contract**: New page POSTs to `/api/admin/catalog` then navigates to the list (or the new item). Edit page loads the item server-side (`getById`); missing id → 404. Form fields: title, description, tags as a comma-separated input mapped to `string[]`. Edit exposes Approve / Reject only (no control that sets `pending`). Show API `details` next to fields. Extract any non-trivial submit logic to `src/components/hooks/` (CLAUDE.md), not `@/hooks`.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes
- `npm run build` passes

#### Manual Verification:

- Admin creates an item from `/admin/catalog/new`; it appears as pending on the list
- Admin edits title, description, and tags on a pending item; values persist after reload
- Admin approves from the list; badge becomes approved; same item can still be edited
- Admin rejects an item; re-approves it from the edit page; filter “Rejected” then “Approved” matches
- Non-admin visiting `/admin/catalog` still gets 403
- No delete button or route is exposed in the UI
- Admin Topbar shows Admin (`/admin/catalog`); non-admin Topbar does not

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: User-facing approved catalog

### Overview

Prove the north star: a signed-in non-admin sees approved items on `/catalog` and never sees pending or rejected ones. Sign-in lands on that page.

### Changes Required:

#### 1. Catalog page

**Files**: `src/pages/catalog.astro`, optional presentational component under `src/components/catalog/`

**Intent**: Authenticated browse-only view of the approved catalog (title, description, tags). No search, no assign.

**Contract**: SSR via `listApproved` (no React island required). Empty state when there are zero approved items (copy should not tell the user to create catalog rows). Do not render status. Do not fetch `/api/admin`. Add a Catalog link (`/catalog`) to Topbar for all signed-in users. Update the 403 page’s “go back” link from `/dashboard` to `/catalog`.

#### 2. Post-login destination

**File**: `src/pages/api/auth/signin.ts`

**Intent**: After a successful sign-in, the collector lands in the product, not the marketing homepage.

**Contract**: Redirect to `/catalog` instead of `/`. Sign-out may still go to `/`. Do not special-case admins here — they use the Admin nav link.

#### 3. README route table

**File**: `README.md`

**Intent**: Document `/catalog`, `/admin/catalog`, and `/403` next to the existing auth routes.

**Contract**: Extend the Auth routes table (or add a Catalog routes table) with: who can access each path, and a one-line pointer to the First admin SQL. Do not rewrite unrelated README sections.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes
- `npm run build` passes

#### Manual Verification:

- Sign in as a non-admin → lands on `/catalog`
- An item the admin approved appears with title, description, and tags
- A pending item and a rejected item created by the admin do **not** appear on `/catalog`
- `/catalog` with zero approved items shows the empty state
- Admin still sees pending/rejected on `/admin/catalog` in the same session
- Signed-out `/catalog` still redirects to sign-in
- Signed-in Topbar shows Catalog; 403 page links to `/catalog`

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

None. No test runner in this change.

### Integration Tests:

None. API behavior is verified with authenticated `fetch` / browser DevTools in Phases 2–4.

### Manual Testing Steps:

1. `npx supabase start` (if needed) and `npx supabase db reset`.
2. Sign up two users (A = future admin, B = collector). Confirm emails if local confirmations are on.
3. In Studio SQL as postgres, promote user A (`UPDATE profiles SET role = 'admin' WHERE id = …`).
4. Sign in as A: Topbar shows Admin. Create “Pending Book”, leave pending. Create “Visible Book”, approve it. Create “Rejected Book”, reject it. Edit “Visible Book” tags.
5. Sign in as B: land on `/catalog`. See only “Visible Book” with updated tags. `/admin/catalog` → 403. Direct `fetch('/api/admin/catalog')` → 403.
6. Sign out: `/catalog` → sign-in.

## Performance Considerations

MVP catalog volume is small (PRD `target_scale.data_volume: small`). List endpoints return all matching rows up to PostgREST `max_rows` (1000). No pagination or search indexes in this slice.

## Migration Notes

- **Local:** `npx supabase db reset` after adding the Phase 1 trigger migration. Then promote an admin in Studio.
- **Production:** Apply the migration before running the promote SQL. Worker deploy does not change Postgres — run `supabase db push` (or the project’s usual migration deploy) as a separate, human-approved step (`context/foundation/infrastructure.md`).
- **Rollback:** Reverting the trigger function restores the “cannot promote even as postgres” bug; only roll back if a replacement promote path exists.
- **Existing users:** No backfill. Every signup already has a `profiles` row from F-01.

## References

- PRD: `context/foundation/prd.md` — FR-001, FR-004, FR-006, Access Control, Guardrails
- Roadmap S-01: `context/foundation/roadmap.md`
- Prerequisite F-01: `context/changes/catalog-schema-rls/plan.md`
- RLS + GRANTs: `supabase/migrations/20260608130000_catalog_rls.sql`, `supabase/migrations/20260608140000_catalog_grants.sql`
- Role lock (to amend): `supabase/migrations/20260608150000_profiles_role_immutable.sql`
- Types: `src/types.ts`
- Session client: `src/lib/supabase.ts`
- Middleware today: `src/middleware.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Admin bootstrap, middleware, and chrome

#### Automated

- [x] 1.1 Migration file exists at `supabase/migrations/20260817120000_profiles_role_bypass_rls.sql` — a166171
- [x] 1.2 `npm run lint` passes — a166171
- [x] 1.3 `npm run build` passes — a166171

#### Manual

- [x] 1.4 `npx supabase db reset` applies the new migration without errors — a166171
- [x] 1.5 Studio SQL as postgres can `UPDATE profiles SET role = 'admin'` — a166171
- [x] 1.6 Authenticated self-update of `profiles.role` still fails — a166171
- [x] 1.7 Signed-out `/catalog` and `/admin/catalog` redirect to sign-in — a166171
- [x] 1.8 Signed-in non-admin `/admin/catalog` returns 403 — a166171
- [x] 1.9 Signed-out `fetch` `/api/admin/catalog` returns 401 JSON — a166171
- [x] 1.10 Signed-in non-admin `fetch` `/api/admin/catalog` returns 403 JSON — a166171
- [x] 1.11 Topbar appears once on Layout pages; Catalog and Admin links are absent — a166171

### Phase 2: Catalog service and admin JSON APIs

#### Automated

- [x] 2.1 `zod` is listed in `package.json` dependencies — 3cae0e5
- [x] 2.2 `npm run lint` passes — 3cae0e5
- [x] 2.3 `npm run build` passes — 3cae0e5

#### Manual

- [x] 2.4 Admin POST creates a pending item — 3cae0e5
- [x] 2.5 Admin PATCH can approve and edit fields — 3cae0e5
- [x] 2.6 Admin GET list and `?status=` filter match expected rows — 3cae0e5
- [x] 2.7 Non-admin admin-API calls return 403; RLS hides pending from the user session — 3cae0e5
- [x] 2.8 Invalid bodies return 400 with `details[].field` — 3cae0e5

### Phase 3: Admin catalog UI

#### Automated

- [x] 3.1 `npm run lint` passes — 5d9df2c
- [x] 3.2 `npm run build` passes — 5d9df2c

#### Manual

- [x] 3.3 Admin can create an item from `/admin/catalog/new` — 5d9df2c
- [x] 3.4 Admin can edit title, description, and tags; values persist — 5d9df2c
- [x] 3.5 Approve from the list updates status; item remains editable — 5d9df2c
- [x] 3.6 Reject then re-approve works; status filters match — 5d9df2c
- [x] 3.7 Non-admin `/admin/catalog` returns 403 — 5d9df2c
- [x] 3.8 No delete control in the UI — 5d9df2c
- [x] 3.9 Admin Topbar shows Admin; non-admin Topbar does not — 5d9df2c

### Phase 4: User-facing approved catalog

#### Automated

- [x] 4.1 `npm run lint` passes — 803628c
- [x] 4.2 `npm run build` passes — 803628c

#### Manual

- [x] 4.3 Sign-in as non-admin lands on `/catalog` — 803628c
- [x] 4.4 Approved item is visible with title, description, and tags — 803628c
- [x] 4.5 Pending and rejected items are not visible on `/catalog` — 803628c
- [x] 4.6 Empty approved catalog shows the empty state — 803628c
- [x] 4.7 Admin still sees pending/rejected on `/admin/catalog` — 803628c
- [x] 4.8 Signed-out `/catalog` redirects to sign-in — 803628c
- [x] 4.9 Signed-in Topbar shows Catalog; 403 page links to `/catalog` — 803628c
