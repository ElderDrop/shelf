# Share URL Re-Copy After Refresh — Plan Brief

> Full plan: `context/changes/share-link-persist-on-refresh/plan.md`
> Frame brief: `context/changes/share-link-persist-on-refresh/frame.md`

## What & Why

> **The actual problem to plan around is**: After reload, the owner cannot re-disclose the *existing* share URL for copying, because the system only ever returns the raw token on create/rotate and stores only a hash — while the share itself remains active, revocable, and valid for visitors.

This plan stores the raw token for authenticated owner GET so Copy works across refreshes without regenerating.

## Starting Point

S-05 share links are live: hash-only DB row, GET status without URL, Copy only from in-memory POST response. UI already shows active + Revoke when a row exists; public resolve still works after refresh.

## Desired End State

After generate, a Library refresh (or later session) still shows the same share URL with Copy. Regenerate still rotates and invalidates the old link. Pre-change rows need one regenerate before re-copy is available.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Problem to solve | Re-disclose same URL to owner | Not a deleted-row / missing-revoke bug | Frame |
| Persistence | Server plaintext `token` + keep `token_hash` | Cross-device; public resolve stays hash-based | Plan |
| API | Extend GET with `url` when token present | Island already GETs on mount | Plan |
| Regenerate | Unchanged (new token, old URL dies) | Clear rotate/revoke mental model | Plan |
| Storage form | Plaintext column (not encrypted) | MVP simplicity; RLS already gates the row | Plan |
| Legacy rows | One regenerate required | Hash not reversible; no force-break all links | Plan |

## Scope

**In scope:** Migration + service dual-write; GET `url`; UI hydrate from GET; Vitest/API guardrails; legacy hint path.

**Out of scope:** At-rest encryption; dropping hash; localStorage-only fix; force-rotate-all migrate; Playwright; recipient/share-page changes.

## Architecture / Approach

Owner session client reads/writes `share_links.token` under existing RLS. Create/rotate writes `token` + `token_hash`. Authenticated GET rebuilds `origin/share/{token}` when `token` is set. Public `/share/[token]` still hashes and looks up `token_hash` via service role.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Schema + service | Nullable `token`; dual-write; get-active exposes token\|null | Mis-wiring resolve to require plaintext |
| 2. API + UI | GET returns `url`; Copy survives refresh | Logging/leaking token; forgetting legacy null case |
| 3. Guardrail tests | Dual-write + GET url/legacy cases locked | Thin API test coverage today |

**Prerequisites:** Local Supabase for migration apply; `readonly-share-link` already shipped.
**Estimated effort:** ~1–2 sessions across 3 phases.

## Open Risks & Assumptions

- Storing plaintext tokens means a DB dump of `share_links` exposes live capability URLs (accepted for MVP; RLS + no anon grants remain mandatory).
- Owners with pre-migration links must regenerate once (visitor links break only if/when they choose to regenerate).

## Success Criteria (Summary)

- Refresh after generate still shows the same URL + Copy
- Public old URL works until regenerate; regenerate invalidates it
- Legacy active-without-token path remains honest until one regenerate
