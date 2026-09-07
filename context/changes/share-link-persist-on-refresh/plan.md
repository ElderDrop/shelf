# Share URL Re-Copy After Refresh Implementation Plan

## Overview

Let the library owner re-copy the **same** share URL after a page reload or new session. Today the share row and public link survive refresh; only the copyable URL string is lost because S-05 stores `token_hash` only and returns the raw token on POST once. This change stores a nullable plaintext `token` for owner re-disclosure via authenticated GET, without changing public resolve, regenerate, or revoke semantics.

## Current State Analysis

Lifted from `frame.md` (HIGH confidence) and codebase check:

- After refresh with an active row: UI shows “Share link is active” + Revoke + Regenerate; Copy is hidden because `url` lives only in React state from the last POST (`ShareLinkControls.tsx`).
- `GET /api/share` returns `{ active, created_at }` only (`src/pages/api/share.ts`); POST alone returns `{ url, token, created_at }`.
- Schema has `token_hash` only (`supabase/migrations/20260906120000_share_links.sql`); public resolve hashes the path token and looks up by hash.
- Prior plan (`readonly-share-link`) intentionally chose token-once / regenerate-to-re-copy — that product choice is what this change revisits for owners.

## Desired End State

Owner generates a share link, refreshes Library (or returns later), and still sees the same URL with Copy available — without regenerating. Revoke and Regenerate behave as today (regenerate issues a new token and invalidates the old public URL). Rows created before this change remain active for visitors but require **one** regenerate before the owner can re-copy (hash is not reversible). Visitors and resolve path are unchanged.

### Key Discoveries:

- RLS on `share_links` is row-scoped (`user_id = auth.uid()`); adding a `token` column needs **no** policy change — keep anon grants absent.
- UI already has `active && !url` “Regenerate to reveal…” — reuse that for legacy hash-only rows.
- `mapShareLink` / `ShareLink` type deliberately omit secrets today (`src/types.ts`, `share.ts`) — extend carefully so GET can build `url` without exposing hash.

## What We're NOT Doing

- Encrypting the stored token at rest (plaintext column chosen for MVP)
- Dropping `token_hash` or changing public resolve to plaintext equality lookup
- localStorage / client-only persistence as the primary fix
- Changing regenerate to soft-rotate or hiding regenerate
- Force-rotating all existing share rows at migrate time
- Playwright e2e for this behavior (Vitest/API/service tests only)
- Revisiting revoke UX, share page chrome, or FR-008 recipient rules

## Implementation Approach

1. Migration: nullable `token text` on `share_links` (no backfill).
2. Service: create/rotate always persist both `token` and `token_hash`; owner get-active returns the stored token when present (null for legacy).
3. API: authenticated GET includes `url` (request-origin + `/share/` + token) when token is present; omit `url` when active but token null.
4. UI: on mount GET, set `url` from response when present; keep legacy regenerate hint otherwise.
5. Tests: dual-write on create/rotate; GET-with-url; legacy active-without-url.

## Critical Implementation Details

**Legacy rows:** Pre-migration rows have `token IS NULL`. Do not invent a URL. GET stays `{ active: true, created_at }` without `url` until the owner regenerates once (writes both columns). Public URL for that row remains valid until regenerate.

**GET sensitivity:** Extended GET returns a live capability URL. Must remain session-gated (existing middleware + `requireUser`). Never log the raw token. Do not add anon access to `share_links`.

**Resolve select stays hash-only:** `service_role` has table-level SELECT on `share_links`, so the new `token` column is readable by privilege. `resolveShareByToken` must keep an **explicit** column list that **omits** `token` (no `select('*')`). Owner `getActiveShareLink` is the only path that selects `token`.

**URL construction:** Keep building absolute URL from **request origin** on GET and POST (`new URL(context.request.url).origin + "/share/" + token`), same as today’s POST.

---

## Phase 1: Schema + share service

### Overview

Persist owner-readable `token` alongside `token_hash` and surface it on owner get-active for the API layer.

### Changes Required:

#### 1. Migration — nullable token

**File**: `supabase/migrations/YYYYMMDDHHmmss_share_links_token.sql` (timestamp at implement time)

**Intent**: Allow storing the raw share token for owner re-disclosure without breaking existing hash-only rows.

**Contract**: `ALTER TABLE public.share_links ADD COLUMN token text;` — nullable, no default, no backfill. Keep `token_hash` NOT NULL and unique. No RLS/grant changes.

#### 2. Types + row mapping

**Files**: `src/types.ts`, `src/lib/services/share.ts`

**Intent**: Model optional owner-readable token on the share link the owner API uses; never put token on public resolve DTOs.

**Contract**: Extend `ShareLinkRow` / select lists used by owner paths to include `token`. Update the `ShareLink` JSDoc in `src/types.ts` (today: “raw token never stored / never returned on GET”) to reflect owner storage + GET returning `url` (not bare token). `getActiveShareLink` returns metadata plus `token: string | null` (or equivalent). `createOrRotateShareLink` writes `{ user_id, token_hash, token: rawToken }` on insert and `{ token_hash, token: rawToken, created_at }` on rotate update. `resolveShareByToken` continues to select/lookup by `token_hash` only — do not require `token` for resolve.

### Success Criteria:

#### Automated Verification:

- Migration applies cleanly against local Supabase (`npx supabase db reset` or project-equivalent)
- `npm run lint` passes
- `npm test` passes (existing suite green; **minimal** service test updates so dual-write / null-token contracts don’t fail CI — full GET url/legacy coverage is Phase 3)

#### Manual Verification:

- After migrate, an existing share row still resolves for visitors; owner GET (via app or curl with session) shows active without url until regenerate

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before Phase 2.

---

## Phase 2: API + Library island

### Overview

Hydrate the copyable URL from authenticated GET and keep the legacy regenerate path clear.

### Changes Required:

#### 1. GET `/api/share` response

**File**: `src/pages/api/share.ts`

**Intent**: When the owner has a stored token, return a rebuildable share URL on status load.

**Contract**: Inactive unchanged `{ active: false }`. Active with token → `{ active: true, created_at, url }` where `url` uses request origin + `/share/` + token. Active without token (legacy) → `{ active: true, created_at }` with **no** `url` field. Do not return raw `token` on GET unless already doing so for POST parity is desired — prefer `url` only on GET to minimize accidental logging of bare secrets in clients; POST may keep returning `{ url, token, created_at }` as today.

#### 2. ShareLinkControls hydration

**File**: `src/components/share/ShareLinkControls.tsx`

**Intent**: Restore Copy UI after refresh when GET supplies `url`.

**Contract**: Extend status type with optional `url`. On successful GET, `setUrl` when `url` present. Keep `active && !url` hint for legacy rows. POST/DELETE behavior unchanged. Regenerate still POST create-or-rotate (new token).

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes
- `npm test` passes (API tests cover GET with url / legacy without url if added this phase or Phase 3)

#### Manual Verification:

- Generate link → refresh Library → same URL visible with Copy; public page still works
- Legacy row (if available): active + Revoke + regenerate hint, no URL until one Regenerate; after regenerate, refresh keeps new URL
- Regenerate still invalidates the previous public URL

**Implementation Note**: Pause for manual confirmation before Phase 3 if tests are deferred; otherwise continue.

---

## Phase 3: Guardrail tests

### Overview

Lock the new contracts so token-once regressions don’t return unnoticed.

### Changes Required:

#### 1. Service + API tests

**Files**: `src/lib/services/share.test.ts`, `src/pages/api/share.test.ts`

**Intent**: Prove dual-write, owner get with/without token, and GET url assembly. Phase 1 only keeps the suite green; this phase owns the full guardrail set (including any dual-write assertions not already present).

**Contract**: Assert create/rotate persist both `token` and `token_hash`. Assert `getActiveShareLink` exposes null vs string token for legacy vs new. Add authenticated GET cases: active+url when token present; active without url when token null. Keep resolve-by-hash tests green.

### Success Criteria:

#### Automated Verification:

- `npm test` passes
- `npm run lint` passes

#### Manual Verification:

- Spot-check Library share controls once more after test-driven tweaks (optional if Phase 2 manual already green)

---

## Testing Strategy

### Unit Tests:

- `createOrRotateShareLink` insert/update payloads include `token` + `token_hash`
- `getActiveShareLink` returns `token: null` for legacy-shaped rows and string when present
- Hash/generate helpers unchanged

### Integration / API Tests:

- GET active + url when service returns token
- GET active without url when token null
- Existing 401 unauth cases remain

### Manual Testing Steps:

1. Fresh generate → copy URL → refresh → same URL + Copy; open URL in private window → lists load
2. Regenerate → old URL 404/soft-fail; new URL works; refresh keeps new URL
3. Revoke → inactive; refresh stays inactive
4. If a pre-migration row exists: active without Copy until one regenerate

## Performance Considerations

None material — one extra nullable column; GET already runs on island mount.

## Migration Notes

- Additive nullable column; deploy-safe. Existing visitor links keep working.
- Owners of pre-change links must regenerate once to unlock re-copy (documented in UI hint already).

## References

- Frame brief: `context/changes/share-link-persist-on-refresh/frame.md`
- Prior design: `context/changes/readonly-share-link/plan.md` (token handling)
- UI: `src/components/share/ShareLinkControls.tsx`
- API: `src/pages/api/share.ts`
- Service: `src/lib/services/share.ts`
- Schema: `supabase/migrations/20260906120000_share_links.sql`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Schema + share service

#### Automated

- [x] 1.1 Migration applies cleanly against local Supabase — 8e6caee
- [x] 1.2 npm run lint passes — 8e6caee
- [x] 1.3 npm test passes (service dual-write / null token) — 8e6caee

#### Manual

- [x] 1.4 Existing share row still resolves; owner status active without url until regenerate — 8e6caee

### Phase 2: API + Library island

#### Automated

- [x] 2.1 npm run lint passes
- [x] 2.2 npm test passes

#### Manual

- [x] 2.3 Generate → refresh → same URL + Copy; public page works
- [x] 2.4 Legacy path: regenerate once then refresh keeps URL
- [x] 2.5 Regenerate invalidates previous public URL

### Phase 3: Guardrail tests

#### Automated

- [ ] 3.1 npm test passes
- [ ] 3.2 npm run lint passes

#### Manual

- [ ] 3.3 Optional spot-check Library share controls after test tweaks
