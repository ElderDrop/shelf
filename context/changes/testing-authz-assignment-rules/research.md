---
date: 2026-09-03T12:01:02+00:00
researcher: Auto
git_commit: c5715bbaafe4ba85a8981d4c77ce09b02aeb6c69
branch: master
repository: ElderDrop/shelf
topic: "Ground rollout Phase 2 — Risks #3 (admin authz) and #4 (assignment rules)"
tags: [research, codebase, admin-authz, assignments, requireAdmin, rls, vitest]
status: complete
last_updated: 2026-09-03
last_updated_by: Auto
---

# Research: Ground rollout Phase 2 — Risks #3 and #4

**Date**: 2026-09-03T12:01:02+00:00  
**Researcher**: Auto  
**Git Commit**: c5715bbaafe4ba85a8981d4c77ce09b02aeb6c69  
**Branch**: master  
**Repository**: ElderDrop/shelf

## Research Question

Ground rollout Phase 2 of `context/foundation/test-plan.md` for Risks #3 and #4: locate real failure paths, verify/correct risk-response guidance, find existing tests, and name the cheapest useful test layer. Write findings for planning. Risk #2 (assignment IDOR) stays deferred.

## Summary

**Risk #3** is real and multi-layered. Admin catalog mutations live on `POST /api/admin/catalog` and especially `PATCH /api/admin/catalog/[id]` (approve/reject). Gates: middleware `isApiAdmin` (401/403) → route `requireAdmin` (403) → RLS `is_admin()`. Phase 1 already unit-tests `requireAdmin` only; that does **not** close #3. Guidance stands: do not treat middleware alone or HTML `/admin` as proof; cheapest next layer is thin HTTP/handler integration on **PATCH approve as non-admin → 403**, optionally plus POST create.

**Risk #4** splits across layers. Library→wishlist demotion is an **app-only** pure guard (`assertNotLibraryToWishlist`, private). Approved-only assign is **RLS** `WITH CHECK` plus service error remapping to a fixed 403 message — there is no app `status === "approved"` read. UI omits demote and only lists approved catalog items; server still enforces. No assignment tests exist. Guidance stands with refinements: export or service-unit the demotion rule; mock RLS-style errors for the non-approved message; thin API asserts for 403 bodies. Do **not** absorb Risk #2.

**Hot-spot dirs** (`src/components/admin`, `src/pages/api`, `src/lib/services`) are directionally correct; failure oracles live in services + middleware/API + RLS, not in React button presence.

## Detailed Findings

### Risk #3 — Admin catalog write/approve authz

#### Admin API surface

Only two route modules; every handler calls `requireAdmin` first:

| Route | Methods | Mutation relevance |
|-------|---------|--------------------|
| [`src/pages/api/admin/catalog.ts`](https://github.com/ElderDrop/shelf/blob/c5715bbaafe4ba85a8981d4c77ce09b02aeb6c69/src/pages/api/admin/catalog.ts) | GET, POST | POST creates (service forces `pending`) |
| [`src/pages/api/admin/catalog/[id].ts`](https://github.com/ElderDrop/shelf/blob/c5715bbaafe4ba85a8981d4c77ce09b02aeb6c69/src/pages/api/admin/catalog/%5Bid%5D.ts) | GET, PATCH | **PATCH** is approve/reject (`status` in body) |

Approve path: PATCH with `{ status: "approved" | "rejected" }` after `requireAdmin` ([id].ts ~50–51, ~70+). Schema: `src/lib/schemas/catalog.ts` (`catalogUpdateSchema`).

#### Gates (three independent checks)

1. **Middleware primary API gate** — [`src/middleware.ts:11-13,68-78`](https://github.com/ElderDrop/shelf/blob/c5715bbaafe4ba85a8981d4c77ce09b02aeb6c69/src/middleware.ts#L68-L78): `isApiAdmin` → no user **401**; non-admin **403**; admin `next()`.
2. **Route helper** — [`src/lib/require-admin.ts:21-25`](https://github.com/ElderDrop/shelf/blob/c5715bbaafe4ba85a8981d4c77ce09b02aeb6c69/src/lib/require-admin.ts#L21-L25): `profile?.role !== "admin"` → **403** `{ "error": "Forbidden" }`. No session check (middleware owns 401).
3. **RLS** — `is_admin()` policies on catalog writes (`supabase/migrations/20260608130000_catalog_rls.sql`).

HTML `/admin` is a separate path ([`middleware.ts:95-103`](https://github.com/ElderDrop/shelf/blob/c5715bbaafe4ba85a8981d4c77ce09b02aeb6c69/src/middleware.ts#L95-L103)): unauthenticated → redirect signin; non-admin → **403 rewrite** `/403` (not a redirect). Proving page gate ≠ proving mutation authz.

#### Role source of truth

- Loaded in middleware from `profiles` after `auth.getUser()` (`middleware.ts` ~37–58) into `locals.profile`.
- Typed as `AppRole = "user" | "admin"` in `src/types.ts`.
- **Not** from JWT claims. Admin promotion is out-of-band.

#### Admin UI

Components (`CatalogList.tsx`, `useCatalogForm.ts`, `CatalogForm.tsx`) always call the admin API; no client role gate. Topbar only hides nav. SSR pages rely on middleware page gate.

#### Existing tests (partial)

- [`src/lib/require-admin.test.ts`](https://github.com/ElderDrop/shelf/blob/c5715bbaafe4ba85a8981d4c77ce09b02aeb6c69/src/lib/require-admin.test.ts) — non-admin / null → 403; admin → `null`.
- No middleware tests, no admin route tests, no PATCH-approve tests.

#### Guidance verdict (#3)

| Guidance | Verdict |
|----------|---------|
| Prove non-admin 403 on admin mutations; cannot approve | **Confirm.** Target PATCH (and ideally POST) as non-admin → 403. Helper-only units are incomplete. |
| Challenge: middleware alone proves the gate | **Confirm.** Three gates; Phase 1 units skip middleware. |
| Avoid: only HTML `/admin` redirect | **Confirm / refine.** Unauth redirects; non-admin gets 403 rewrite. Still not mutation proof. |
| Cheapest layer: Integration | **Confirm with refine.** Next cheapest: authenticated non-admin → real or handler-level `PATCH/POST /api/admin/...` → 403. Reuse Phase 1 helper units as regression floor. RLS remains optional durable co-oracle. |

**Dual-gate drift** remains (middleware predicate vs `requireAdmin`); JSDoc cross-links exist; not consolidated. Phase 2 tests should not assume consolidating gates — only locking the failure mode.

---

### Risk #4 — Assignment business rules

#### API surface

| File | Methods |
|------|---------|
| [`src/pages/api/assignments.ts`](https://github.com/ElderDrop/shelf/blob/c5715bbaafe4ba85a8981d4c77ce09b02aeb6c69/src/pages/api/assignments.ts) | GET, POST (`assign`) |
| [`src/pages/api/assignments/[id].ts`](https://github.com/ElderDrop/shelf/blob/c5715bbaafe4ba85a8981d4c77ce09b02aeb6c69/src/pages/api/assignments/%5Bid%5D.ts) | PATCH (`updateListType`), DELETE |

Auth: `locals.user` → else 401; middleware also 401s unauthenticated assignment APIs. Errors: `forbidden` → **403** with service message.

UI moves use **POST** `/api/assignments` (`useAssignmentActions`), not PATCH — but PATCH remains a live contract and must be covered for demotion.

#### Rule A — Library → wishlist forbidden (app)

```91:96:src/lib/services/assignments.ts
/** Library is terminal for list-type: demoting to wishlist is forbidden. */
function assertNotLibraryToWishlist(current: ListType, target: ListType): void {
  if (current === "library" && target === "wishlist") {
    throw new AssignmentServiceError("forbidden", "Cannot move a library item to wishlist");
  }
}
```

Called from `assign` (upsert path ~188) and `updateListType` (~244). Wishlist → library has no special block. **RLS does not enforce list-type lock.**

#### Rule B — Assign only approved items (RLS + mapping)

No app-layer `status === "approved"` check on assign. Insert/update relies on RLS:

```sql
-- supabase/migrations/20260608130000_catalog_rls.sql (user_assignments_insert_own_approved)
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.catalog_items AS ci
    WHERE ci.id = catalog_item_id AND ci.status = 'approved'
  )
);
```

Service remaps RLS/permission failures to `"Cannot assign to a non-approved catalog item"` (~185, ~206, ~219) → API 403.

#### Client vs server

- UI **omits** “Move to wishlist” when already library (`CatalogItemActions`, `CollectionItemActions`).
- User catalog uses `listApproved` only — pending never offered to assign.
- Challenge stands: missing UI ≠ server rule.

#### Existing tests

**None** for assignments. Catalog tests cover Risk #1 filter only. RLS checklist comments in `supabase/tests/rls_catalog.sql` are not CI.

#### Guidance verdict (#4)

| Guidance | Verdict |
|----------|---------|
| Prove non-approved fails; library→wishlist rejected; wishlist→library OK | **Confirm.** Cover demotion on both POST upsert and PATCH. |
| Challenge: client-disabled ≡ server | **Confirm.** |
| Avoid: UI state machine as oracle | **Confirm.** |
| Unit (pure) + thin API | **Refine.** (1) Export or exercise `assertNotLibraryToWishlist` via service + query mock. (2) Unit-map non-approved via fake PostgREST/RLS errors → fixed message (locks mapping, not RLS). (3) Thin API/handler 403 + body. True RLS proof optional / later — not required to start Phase 2. |

#### Risk #2 flag (deferred)

Ownership on mutate is RLS `user_id = auth.uid()`, not an app ownership helper shared with #4. Same ID surfaces — **do not expand Phase 2 into cross-user IDOR suites** (`test-plan.md` §6.6).

---

### Existing suite & stack patterns

| File | Role |
|------|------|
| `src/lib/services/catalog.smoke.test.ts` | Bootstrap / alias smoke |
| `src/lib/services/catalog.test.ts` | `.eq("status","approved")` oracle (Risk #1) |
| `src/lib/require-admin.test.ts` | Admin helper 403 (partial Risk #3) |
| `src/lib/services/__tests__/supabase-query-mock.ts` | Reusable PostgREST chain fake |

Cookbook §6.1 / §6.4: colocate `*.test.ts`; name by failure mode; do not import Astro admin routes that pull `astro:env` without isolation — unit helpers/services instead.

## Code References

- `src/lib/require-admin.ts:21-25` — shared admin gate helper
- `src/middleware.ts:68-78` — primary `/api/admin` 401/403
- `src/middleware.ts:95-103` — HTML `/admin` gate (≠ mutation proof)
- `src/pages/api/admin/catalog.ts:28-29,55-56` — GET/POST `requireAdmin`
- `src/pages/api/admin/catalog/[id].ts:28-29,50-51` — GET/PATCH `requireAdmin` (approve)
- `src/lib/services/assignments.ts:91-96` — library→wishlist guard
- `src/lib/services/assignments.ts:185-219,244` — non-approved mapping + demotion call sites
- `src/pages/api/assignments.ts` / `[id].ts` — POST/PATCH contracts + 403 mapping
- `supabase/migrations/20260608130000_catalog_rls.sql` — approved-only assign + `is_admin` catalog writes
- `src/lib/require-admin.test.ts` — only existing #3-related test

## Architecture Insights

- **Defense in depth is intentional** for admin writes (middleware + helper + RLS). Tests must name which layer they lock; one green suite does not imply the others.
- **Assignment rules are split-brain**: demotion is app-pure; approved-assign is DB-first. Planning must not invent a single “assignment rules” function that does not exist.
- **Oracle independence**: assert fixed HTTP status/messages and (for demotion) the guard condition — not button labels or UI disabled state. For approved-assign, distinguishing “mapping unit” vs “RLS integration” avoids a false sense of DB proof.
- Phase 1 pattern (extract testable helper away from `astro:env`) remains the template for any route-level work.

## Historical Context (from prior changes)

- `context/archive/2026-08-17-admin-catalog-approval/` — Non-admins → 403 on `/admin` and `/api/admin`; unauth APIs → 401; handlers re-check role; PATCH status only `approved`\|`rejected`.
- `context/archive/2026-08-23-catalog-search-assign/` — Library terminal; non-approved assign → 403 via RLS; library→wishlist → `forbidden`/403 on POST and PATCH; wishlist→library allowed.
- `context/changes/testing-critical-path-bootstrap/` — Extracted `requireAdmin` for Node Vitest; deferred full Risk #3 mutations, Risk #2 IDOR, RLS CI. Impl-review noted dual-gate drift (JSDoc interim).

## Related Research

- No prior `research.md` under `context/changes/` or `context/archive/` for these risks.
- Phase 1 plan/frame: `context/changes/testing-critical-path-bootstrap/plan.md`, `frame.md`.

## Open Questions

1. **#3 integration shape**: Prefer invoking route handlers with fake `APIContext` (like `requireAdmin` units) vs spinning a workerd/Playwright session? Cost × signal likely favors handler/context stubs unless middleware must be in-process for the chosen prove criteria.
2. **Export demotion helper?** Exporting `assertNotLibraryToWishlist` simplifies the pure unit; testing only via `updateListType` avoids API surface growth.
3. **Whether Phase 2 should touch RLS CI** for approved-assign — recommended as optional stretch; mapping unit + demotion unit close most of the guidance without Docker/RLS runner.
4. **Test-plan §2 Source for #3/#4** — hot-spot dirs remain valid; no backport required for anchors (research grounds paths here). Optional guidance tweak: #3 “Likely cheapest layer” could note “unit helper already landed; remaining = mutation integration”; #4 should note “approved gate is RLS, not a pure app check.” Suggest `/10x-test-plan` backport or defer to `--refresh` if product wants §2 cells updated.

## Recommended plan shape (for `/10x-plan`)

1. Risk #3 — non-admin PATCH (approve) → 403; optionally POST; keep existing `requireAdmin` tests green; do not treat HTML `/admin` as done.
2. Risk #4 — demotion unit (POST upsert + PATCH paths); wishlist→library allowed; non-approved assign mapping unit and/or thin API 403.
3. Cookbook §6 updates for authz + assignment patterns; explicitly leave Risk #2 out.
4. No requirement to consolidate middleware/`requireAdmin` in this change unless planning chooses Fix B from Phase 1 review as optional.
