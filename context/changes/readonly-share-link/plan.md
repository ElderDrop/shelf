# Read-Only Share Link Implementation Plan

## Overview

Implement FR-008 / S-05: an opt-in public share link that exposes the owner's library and wishlist as read-only. One active link per user, with revoke and regenerate. Recipients (signed out or signed in as someone else) view both lists without edit controls; assignment mutate APIs stay session-owned and do not accept a share token as auth.

## Current State Analysis

- Library and wishlist live in `user_assignments` with own-row RLS (`user_assignments_select_own` and siblings in `supabase/migrations/20260608130000_catalog_rls.sql`). Grants are to `authenticated` only — no anon table access (`20260608140000_catalog_grants.sql`).
- `/library` and `/wishlist` are in `PROTECTED_ROUTES`; `/api/assignments*` returns JSON 401 without a session (`src/middleware.ts`).
- `listForUser` relies on RLS for the current user (`src/lib/services/assignments.ts`) — it cannot serve another user's collection under a recipient session.
- No share tables, routes, or service-role client exist. Prior slices explicitly deferred share tokens to S-05.
- Collection lists are inline Astro markup; mutate UI is `CollectionItemActions`. No clipboard/dialog pattern yet; shadcn has Button/Input only for this surface.
- Test-plan Risk #5 / Phase 4 expects automated proof that share recipients cannot mutate; e2e pattern remains TBD after this slice.

## Desired End State

A signed-in owner opens Library, generates one share URL covering library + wishlist, copies it, and can revoke or regenerate. Anyone with the URL opens a public page showing both lists (title, description, tags) with **no** move/remove controls. Invalid or revoked tokens show a soft failure page with no owner identity or partial data. Unauthenticated calls to assignment mutate endpoints still 401; presenting a share token does not authorize writes. `SUPABASE_SERVICE_ROLE_KEY` is wired for a narrow share-resolve helper (reusable later by S-03), never for owner session paths.

### Key Discoveries:

- Anon cannot read `user_assignments` today — public share **requires** a privileged resolve path (`createServiceClient` + narrow helper), not anon RLS on the assignments table.
- Infrastructure pre-mortem warns against mis-scoped service role on Workers (`context/foundation/infrastructure.md`) — confine service-role use to share resolve (and future enrichment), never middleware/default clients.
- Owner re-copy after reload: store only `token_hash` server-side; raw token returned on create/regenerate only — after reload, Copy needs Regenerate or in-memory state from the last create response.
- Middleware must **not** add `/share` to `PROTECTED_ROUTES`.

## What We're NOT Doing

- Friends / social graph, per-person or per-group visibility
- Separate links for library vs wishlist, or owner-configurable list scope
- Time-based link expiry (revoke/regenerate only)
- SECURITY DEFINER RPC as the primary resolve path (service-role helper chosen instead)
- Denormalized/frozen snapshots of the collection at share time (live reads)
- Playwright e2e for share (deferred; test-plan §6.3 TBD) — API/unit guardrail tests only this slice
- Hiding Topbar on the share page (accept signed-in/out chrome; no edit actions on the share body)
- Confirm dialog for revoke (direct button, matching collection remove)
- Public catalog or anon grants on domain tables

## Implementation Approach

1. Persist one active share link per user (hashed token); owner manages via session client + RLS.
2. Wire optional `SUPABASE_SERVICE_ROLE_KEY` and a cookie-free `createServiceClient()`; expose **only** a narrow `resolveShareByToken` (or equivalent) that hashes the raw token, loads the owner, and returns approved library + wishlist embeds.
3. Owner JSON API under `/api/share` (session-gated); public SSR page `/share/[token]` calls the resolve helper — no mutate methods on that path.
4. Library-page React island for generate / copy / revoke / regenerate; share page duplicates collection list markup without `CollectionItemActions`.
5. Automated tests prove resolve happy path and that assignment APIs reject unauthenticated mutate (and ignore share tokens).

## Critical Implementation Details

**Service-role blast radius:** `createServiceClient()` must never be passed into `assign` / `updateListType` / `remove`, `listForUser`, or any helper that omits an explicit `user_id` filter — those rely on RLS, which service role bypasses. Resolve must `.eq("user_id", ownerId)` (or equivalent) on assignments.

**Approved catalog on resolve (load-bearing):** Session assignment embeds omit a status filter and rely on catalog RLS (`approved` or admin). Service role bypasses that RLS — the same select would leak pending/rejected title/description/tags on the public share page. Resolve must restrict catalog to `status = 'approved'` (e.g. PostgREST `catalog_items!inner(...)` with status filter, or omit non-approved rows in JS). Do **not** render owner-style “Unavailable” stubs for non-approved items on the share page — omit them. Missing service-role key → share page soft-fails closed (same class as invalid token / config error), not an anon table probe.

**Token handling:** Generate a high-entropy opaque token; persist `token_hash` (e.g. SHA-256 hex via **Web Crypto** `crypto.subtle.digest` — not Node `crypto`) only. Lookup hashes the inbound path param. Never log raw tokens. Create/rotate (`POST`) builds the absolute share URL from the **request origin**: `new URL(context.request.url).origin + "/share/" + rawToken` (no `site` / SITE_URL in this repo). Alternatively return `{ token }` / `{ path }` and let the island prefix `window.location.origin`. GET status returns `{ active, created_at }` without the raw token.

**Owner on their own share URL:** Recipient view stays read-only even if the viewer is the owner — edit remains on `/library` / `/wishlist` only. Avoid mounting action islands on `/share/[token]`.

---

## Phase 1: Share schema + service-role scaffolding

### Overview

Add `share_links` persistence and the privileged Supabase client plumbing without product UI yet.

### Changes Required:

#### 1. Migration — share_links

**File**: `supabase/migrations/YYYYMMDDHHmmss_share_links.sql` (timestamp at implement time)

**Intent**: Store at most one active share link per user with a hashed token; enable RLS so owners manage their own rows and anon cannot read the table.

**Contract**: Table `share_links` with at least `id`, `user_id` → `auth.users` (**UNIQUE** — one row per user), `token_hash` unique, `created_at`. **Delete-on-revoke** (no `revoked_at`): revoke deletes the row; regenerate deletes then inserts. RLS: authenticated SELECT/INSERT/UPDATE/DELETE own rows only. Grants: `authenticated` as needed; **no** anon grants on `share_links`.

#### 2. Types

**File**: `src/types.ts`

**Intent**: Add a `ShareLink` (or equivalent) type for service/API mapping.

**Contract**: Fields mirror the table columns the app reads (id, user_id, created_at). Do not include raw token. Absence of a row means no active link (revoked or never created).

#### 3. Service-role client + env

**Files**: `astro.config.mjs`, `src/lib/supabase-service.ts` (new), `.env.example`, `scripts/deploy-prod.sh`, README secret tables as needed

**Intent**: Introduce an optional server-only service-role client distinct from the cookie SSR anon client.

**Contract**: `SUPABASE_SERVICE_ROLE_KEY` in `env.schema` (`context: "server"`, `access: "secret"`, `optional: true`). `createServiceClient()` uses `@supabase/supabase-js` `createClient` with no cookies and auth persistence disabled; returns `null` when URL or key missing. Deploy script puts the new Wrangler secret when present (or require it for prod share — document). Do not change `createClient` in `src/lib/supabase.ts` behavior.

### Success Criteria:

#### Automated Verification:

- Migration applies cleanly against local Supabase (`npx supabase db reset` or project-equivalent migrate)
- `npm run lint` passes
- `npm test` passes (existing suite green)

#### Manual Verification:

- `.env.example` documents `SUPABASE_SERVICE_ROLE_KEY`; local `.dev.vars` can set the service_role key from `supabase status`
- Confirmed no anon GRANT on `share_links`

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before Phase 2.

---

## Phase 2: Share service + APIs

### Overview

Owner can create/revoke/regenerate/status via session API; public resolve loads both lists through the narrow service-role helper.

### Changes Required:

#### 1. Share service

**File**: `src/lib/services/share.ts` (new)

**Intent**: Encapsulate token generation/hashing, owner lifecycle, and privileged resolve without leaking service-role into assignment mutations.

**Contract**:
- Owner ops take the **session** `SupabaseClient`: get active link metadata; create-or-rotate (delete existing row if any, then insert); revoke (delete row).
- `resolveShareByToken(rawToken)` (name flexible) uses **only** `createServiceClient()`: hash → lookup row by `token_hash` (missing row = invalid/revoked) → load that `user_id`'s assignments with **approved-only** catalog title/description/tags (inner/status filter or JS omit — see Critical Implementation Details), split or tag by `list_type` library vs wishlist. Return a structured read model or a typed not-found/revoked error. Never call `listForUser` with the service client.
- Do not call `assign` / `updateListType` / `remove` from this module.

#### 2. Zod schemas

**File**: `src/lib/schemas/share.ts` (new)

**Intent**: Validate owner API inputs if any (e.g. empty POST bodies); path token shape for resolve if validated in API/page.

**Contract**: Keep schemas minimal; token as non-empty string with a sane max length.

#### 3. Owner API

**File**: `src/pages/api/share.ts` (new) — and/or small subroutes if clearer

**Intent**: Session-gated JSON API for share lifecycle.

**Contract**: `export const prerender = false`. Middleware: add `/api/share` to the same JSON-401 unauthenticated pattern as assignments (extend `src/middleware.ts`). Handlers use `requireUser` + session `createClient`. Surface:
- `GET` — `{ active: boolean, created_at?: string }` (no raw token)
- `POST` — create-or-rotate: always issues a new raw token; delete existing row if any, then insert. **201** if no prior row, **200** if rotated (mirror assignments created signaling). Response includes absolute share URL (or token + path) **once**
- `DELETE` — revoke (delete row); idempotent OK if already absent
Island labels Generate vs Regenerate from `active` on GET. Errors map like assignments (`jsonError` / service error codes).

#### 4. Resolve usage (server-only)

**File**: consumed by Phase 3 page; optional thin `GET /api/share/resolve` is **out of preference** — prefer SSR page calling the service directly to avoid a public JSON dump endpoint unless needed for the island. If an API is added, it must be read-only and return the same soft-failure semantics.

**Intent**: Keep public read on the SSR page path.

**Contract**: No write methods; no acceptance of share token on `/api/assignments*`.

### Success Criteria:

#### Automated Verification:

- Unit tests for hash/create/revoke/resolve happy path and not-found (mock clients as in `assignments.test.ts`)
- `npm test` and `npm run lint` pass

#### Manual Verification:

- Authenticated `GET`/`POST`/`DELETE` on `/api/share` behave as designed (smoke with curl or similar)
- Unauthenticated `/api/share` returns 401 JSON
- Resolve with service role returns both list types for a seeded owner; revoked token fails closed

**Implementation Note**: Pause for manual confirmation before Phase 3.

---

## Phase 3: Owner + recipient UI

### Overview

Library-page controls for the owner; public read-only share page for recipients.

### Changes Required:

#### 1. Owner share island

**Files**: `src/components/share/ShareLinkControls.tsx` (new), optional `src/components/hooks/useShareLink.ts`, `src/pages/library.astro`

**Intent**: Let the owner generate, copy, revoke, and regenerate the share link where the collection lives.

**Contract**: Mount under Library header (after subtitle, before recommendations/list). Uses Button (+ Input if showing URL). Calls `/api/share`: GET for active state; POST for Generate/Regenerate (label from `active`); DELETE for Revoke. Copy via `navigator.clipboard.writeText` from last POST URL with inline “Copied” / error text. After reload without raw token: show active state + Revoke + Regenerate (POST reveals new URL). Do not add Dialog. Optional light mention or link on wishlist is out of scope unless trivial — Library is the home.

#### 2. Public share page

**File**: `src/pages/share/[token].astro` (new)

**Intent**: Anyone with the URL sees library and wishlist sections with no edit actions; invalid/revoked tokens get a soft failure page.

**Contract**: Not in `PROTECTED_ROUTES`. Call `resolveShareByToken`; on success render two clear sections (Library / Wishlist) reusing the collection row markup pattern from `library.astro` / `wishlist.astro` **without** `CollectionItemActions` / `CatalogItemActions`. Empty lists: simple empty copy per section. On failure: message like “This share link is invalid or has been revoked” — no owner id, email, or partial items. Missing service-role config → same soft failure class (fail closed).

#### 3. Middleware alignment

**File**: `src/middleware.ts`

**Intent**: Keep `/share/*` public; protect `/api/share` like other collector JSON APIs.

**Contract**: Unauthenticated `/api/share` → 401 JSON; `/share/...` pages not redirected to sign-in.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes
- `npm test` passes
- `npm run build` succeeds with env secrets available as in CI

#### Manual Verification:

- Owner: generate → copy → open in private window → both lists visible, no edit controls
- Revoke → prior URL shows soft failure; regenerate → old URL dead, new URL works
- Signed-in non-owner opening share URL: read-only (no actions); their own `/library` unchanged
- Owner opening own share URL: still read-only on that page
- Attempt POST/DELETE `/api/assignments` without session → 401 even with `Referer` or token in query/body if tried

**Implementation Note**: Pause for manual confirmation before Phase 4.

---

## Phase 4: Guardrail tests

### Overview

Automate the load-bearing privacy guardrail called out in the test plan (Risk #5), without waiting on Playwright.

### Changes Required:

#### 1. Share service / API tests

**Files**: `src/lib/services/share.test.ts` (new), and/or `src/pages/api/share.test.ts` if handlers are tested like admin catalog

**Intent**: Lock resolve success and owner authz; prove assignment mutate path ignores share tokens.

**Contract**:
- Resolve returns library + wishlist for a valid active token (mocked service client).
- Revoked/missing token → not-found style error.
- Assignment API tests (extend existing or add focused cases): unauthenticated POST/PATCH/DELETE → 401; request that includes a share token header/query/body still 401 without session (token is not a credential for mutate).
- Do not require a running browser.

#### 2. Test-plan pointer (light touch)

**File**: `context/foundation/test-plan.md` only if a one-line Phase 4 status note is clearly useful — otherwise skip doc churn and leave Phase 4 rollout to `/10x-test-plan`.

**Intent**: Avoid writing tests against fiction; this phase implements the proof the test plan asked for.

**Contract**: Prefer code tests over foundation doc edits unless the user asks to advance test-plan Phase 4 formally.

### Success Criteria:

#### Automated Verification:

- New tests fail if resolve skips revoked check or if assignments accept unauthenticated mutate
- `npm test` and `npm run lint` pass

#### Manual Verification:

- Spot-check: revoked link in browser still soft-fails after tests land

**Implementation Note**: After Phase 4, change is ready for `/10x-impl-review` / archive when accepted.

---

## Testing Strategy

### Unit Tests:

- Token hash + create/revoke/regenerate invariants (one active link)
- `resolveShareByToken` happy path and revoked/missing
- Assignment mutate 401 without session (share token not accepted)

### Integration Tests:

- None required beyond Vitest + mocked Supabase clients for this slice
- Manual RLS spot-check: anon cannot SELECT `share_links` or `user_assignments`

### Manual Testing Steps:

1. Seed library + wishlist as user A; generate link; open as anonymous → both sections, no actions
2. As user B (signed in), open A's link → read-only; B cannot mutate A's items via UI or API
3. Revoke; confirm soft failure; regenerate; confirm old URL dead
4. Confirm `/library` still has edit actions for the owner

## Performance Considerations

Same PostgREST `max_rows` (~1000) cap as library/wishlist lists — acceptable for MVP. Resolve is one share lookup + one assignments query (or two filtered queries); no caching required.

## Migration Notes

Additive migration only. No backfill. Deploy: set `SUPABASE_SERVICE_ROLE_KEY` in Wrangler secrets (and `.dev.vars` locally) before relying on public share in that environment; without it, share pages fail closed.

## References

- PRD FR-008, NFRs, Access Control: `context/foundation/prd.md`
- Roadmap S-05: `context/foundation/roadmap.md`
- Assignments service: `src/lib/services/assignments.ts`
- Middleware: `src/middleware.ts`
- RLS: `supabase/migrations/20260608130000_catalog_rls.sql`
- Test plan Risk #5 / Phase 4: `context/foundation/test-plan.md`
- Infra service-role warning: `context/foundation/infrastructure.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Share schema + service-role scaffolding

#### Automated

- [x] 1.1 Migration applies cleanly against local Supabase
- [x] 1.2 npm run lint passes
- [x] 1.3 npm test passes (existing suite green)

#### Manual

- [x] 1.4 .env.example documents SUPABASE_SERVICE_ROLE_KEY; local .dev.vars can set service_role key
- [x] 1.5 Confirmed no anon GRANT on share_links

### Phase 2: Share service + APIs

#### Automated

- [ ] 2.1 Unit tests for hash/create/revoke/resolve happy path and not-found
- [ ] 2.2 npm test and npm run lint pass

#### Manual

- [ ] 2.3 Authenticated GET/POST/DELETE on /api/share behave as designed
- [ ] 2.4 Unauthenticated /api/share returns 401 JSON
- [ ] 2.5 Resolve with service role returns both list types; revoked token fails closed

### Phase 3: Owner + recipient UI

#### Automated

- [ ] 3.1 npm run lint passes
- [ ] 3.2 npm test passes
- [ ] 3.3 npm run build succeeds with env secrets available as in CI

#### Manual

- [ ] 3.4 Owner generate → copy → private window shows both lists, no edit controls
- [ ] 3.5 Revoke soft-fails prior URL; regenerate kills old URL
- [ ] 3.6 Signed-in non-owner share view is read-only
- [ ] 3.7 Owner own share URL is read-only on that page
- [ ] 3.8 Unauthenticated assignment mutate still 401

### Phase 4: Guardrail tests

#### Automated

- [ ] 4.1 New tests fail if resolve skips revoked check or assignments accept unauthenticated mutate
- [ ] 4.2 npm test and npm run lint pass

#### Manual

- [ ] 4.3 Spot-check revoked link in browser still soft-fails
