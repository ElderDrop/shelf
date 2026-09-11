# Read-Only Share Link — Plan Brief

> Full plan: `context/changes/readonly-share-link/plan.md`

## What & Why

FR-008 / S-05: the collector generates an opt-in public link that exposes **library and wishlist** together as **read-only**. Recipients must see the collection without edit/delete; libraries stay private until a link is created.

## Starting Point

`user_assignments` is own-row RLS only with no anon grants. `/library` and `/wishlist` are session-protected; mutate APIs already 401 without a user. No share table, public route, or service-role client exists — prior slices deferred this to S-05.

## Desired End State

Owner generates one active share URL from Library, can copy / revoke / regenerate. Anyone with the URL sees both lists (title, description, tags) with no action controls. Invalid or revoked links soft-fail without leaking owner data. Assignment writes remain session-owned; a share token is never a write credential.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| -------- | ------ | ---------------- | ------ |
| Link scope | Library + wishlist, one URL | Matches FR-008 success criteria | Plan |
| Lifecycle | One active link; revoke + regenerate | Privacy without expiry complexity | Plan |
| Recipient access | Anyone with URL; signed-in non-owners still read-only | Matches “publiczny link”; mutate stays owner-scoped | Plan |
| Owner UX | Controls on Library page | Share where the collection lives | Plan |
| Privileged read | Service-role client + narrow resolve helper | Reuses wiring for S-03; keep anon table grants fail-closed | Plan |
| Resolve catalog filter | Approved-only (`!inner`/omit); never `listForUser` + service role | Service role bypasses catalog RLS — would leak pending metadata | Plan review |
| Revoke model | Delete-on-revoke; UNIQUE(user_id) | Simplest one-active-link semantics | Plan review |
| Owner API | GET status; POST create-or-rotate (201/200); DELETE revoke | Mirrors assignments upsert signaling | Plan review |
| Share URL | Request origin + `/share/{token}` | No `site`/SITE_URL in repo | Plan review |
| Recipient UI | One page, Library / Wishlist sections, no actions | Clear mental model; easy guardrail check | Plan |
| Bad token UX | Soft failure page, no partial data | Clear UX without identity leak | Plan |
| Guardrail proof | Vitest/API tests this slice; Playwright later | Aligns with test-plan Risk #5 without premature e2e | Plan |

## Scope

**In scope:**

- `share_links` migration + owner RLS
- `SUPABASE_SERVICE_ROLE_KEY` + `createServiceClient()` + deploy/docs wiring
- Share service, `/api/share`, public `/share/[token]`
- Library share island; read-only recipient page
- Automated no-edit / resolve tests

**Out of scope:**

- Friends, per-person visibility, expiry, per-list links
- SECURITY DEFINER RPC as primary path; collection snapshots
- Playwright e2e; revoke confirm dialog; hiding Topbar on share

## Architecture / Approach

```
Owner (session) → /api/share → share service → share_links (RLS own-row)
Recipient → /share/[token] → resolveShareByToken → createServiceClient()
                              → user_assignments + approved catalog embeds (read-only)
Mutate → /api/assignments* (session + RLS only; token ignored)
```

## Phases at a Glance

| Phase | What it delivers | Key risk |
| ----- | ---------------- | -------- |
| 1. Schema + service-role scaffolding | `share_links` + env/client wiring | Accidental anon grants or broad service-role use |
| 2. Share service + APIs | Create/revoke/resolve | Resolve over-fetches or mutates via service role |
| 3. Owner + recipient UI | Library controls + public page | Edit islands mounted on share URL |
| 4. Guardrail tests | CI proof of no-edit | Tests mock reality but miss middleware gaps |

**Prerequisites:** S-02 done (library/wishlist); local Supabase; service_role key in `.dev.vars` for resolve.
**Estimated effort:** ~2–3 sessions across 4 phases.

## Open Risks & Assumptions

- Raw token returned only on create/regenerate (hash stored); after reload, Copy needs Regenerate or in-memory URL.
- Service role bypasses RLS — discipline on the narrow helper is load-bearing.
- PostgREST ~1000-row cap applies to shared lists (same as owner views).

## Success Criteria (Summary)

- Owner can generate, copy, revoke, and regenerate a link from Library.
- Recipient sees library + wishlist with no edit UI; mutate APIs stay 401 without a session.
- Revoked/invalid links soft-fail with no owner or collection leakage.
