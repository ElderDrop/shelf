# Testing Authz & Assignment Rules Implementation Plan

## Overview

Automate Risk #3 and Risk #4 from `context/foundation/test-plan.md` Phase 2: prove a non-admin cannot approve catalog items via admin `PATCH`, and prove assignment business rules (library→wishlist forbidden; wishlist→library OK; non-approved assign surfaces the fixed forbidden message). Stay on Node Vitest; do not absorb Risk #2 (IDOR) or runnable RLS CI.

## Current State Analysis

- Phase 1 shipped Vitest, `listApproved` filter oracle, shared `requireAdmin` unit tests, and CI `npm test`. That helper coverage is a **partial** Risk #3 signal only — it never invokes `PATCH` approve/reject.
- Admin mutations: `PATCH /api/admin/catalog/[id]` calls `requireAdmin` then `createClient` then `update` (`src/pages/api/admin/catalog/[id].ts:49-85`). Static import of the route pulls `@/lib/supabase` → `astro:env/server`, so Node Vitest must mock before import.
- Middleware owns primary `/api/admin` 401/403 (`src/middleware.ts:68-78`); HTML `/admin` is a separate rewrite gate — not mutation proof.
- Demotion: private `assertNotLibraryToWishlist` in `src/lib/services/assignments.ts:91-96`, called from `assign` upsert path and `updateListType`. RLS does **not** enforce list-type lock.
- Approved-only assign: RLS `WITH CHECK` + service remaps permission/policy/RLS-style insert errors (and some 23505/empty-update paths) to `"Cannot assign to a non-approved catalog item"`. No app `status === "approved"` read.
- No assignment `*.test.ts` files yet. Risk #2 ownership remains RLS-only on the same mutate surfaces — out of scope.

### Key Discoveries:

- `requireAdmin` runs **before** `createClient` at runtime, so a non-admin `PATCH` test can assert 403 and that `update` was never called if mocks load cleanly (`[id].ts:49-51`).
- UI omits demote and only lists approved catalog — must **not** be the oracle (research + test-plan anti-patterns).
- Injectable `SupabaseClient` on assignment service enables demotion and mapping units without Astro.

## Desired End State

After this plan completes:

1. Non-admin (and null-profile) `PATCH` with `{ status: "approved" }` and `{ status: "rejected" }` returns HTTP 403 `{ "error": "Forbidden" }`; catalog `update` is not invoked.
2. Existing `requireAdmin` unit tests remain green (regression floor).
3. `assertNotLibraryToWishlist` is exported (or equivalently named pure export); unit tests prove library→wishlist throws `AssignmentServiceError` `forbidden` with the fixed message; wishlist→library does not throw that error.
4. Service-level tests prove demotion is enforced on both `updateListType` and `assign` upsert paths (no DB `update` when demoting).
5. Service-level tests prove RLS-style insert failures map to `"Cannot assign to a non-approved catalog item"`.
6. `context/foundation/test-plan.md` §6 documents the new patterns; §6.6 notes Phase 2 shipped and Risk #2 still deferred. §1–§2 risk map not rewritten.

**Verification:** `npm test`, `npm run lint`, `npm run build` pass; human confirms cookbook matches files and no IDOR suite landed.

## What We're NOT Doing

- Risk #2 assignment IDOR / cross-user ownership tests.
- Middleware-in-process or workerd/Playwright session tests for admin APIs.
- HTML `/admin` page-gate tests as proof of Risk #3.
- POST `/api/admin/catalog` dedicated mutation test (same `requireAdmin` first line; PATCH approve is the prove target).
- Runnable RLS/pgTAP CI for approved-only assign (mapping unit only; true DB oracle deferred).
- Consolidating middleware + `requireAdmin` into one function (optional later; JSDoc cross-links stay).
- Recommendations, share-link, enrichment tests; rewriting test-plan §1–§2.

## Implementation Approach

Three phases by cost × signal: lock admin PATCH denial first (highest impact remaining for #3), then assignment rules (#4), then cookbook handoff.

**Risk #3 handler test:** Prefer `vi.mock("@/lib/supabase")` and `vi.mock("@/lib/services/catalog")` (or spy on `update`) **before** importing `PATCH` from the admin `[id]` route. Call `PATCH` with a minimal fake `APIContext` (`locals.profile` = user/null, `params.id` valid UUID, `request` with JSON approve/reject body). Assert status 403, body `{ error: "Forbidden" }`, and `update` not called. Do **not** treat middleware-alone or HTML `/admin` as success.

**Risk #4:** Export the demotion helper for a pure oracle; exercise `updateListType` and `assign` with the existing query-mock style (extend mock if upsert sequencing needs it). Mapping unit: feed insert errors with `42501` and/or messages containing `permission` / `policy` / `row-level security` and assert the fixed forbidden message — document explicitly that this locks **mapping**, not RLS.

## Critical Implementation Details

- **Module load order for admin PATCH:** Route file top-level-imports `@/lib/supabase`. Without mocks registered first, Vitest fails at import time on `astro:env/server`. Follow Phase 1’s deferred optional path: mock supabase (and catalog service) in the test file before the dynamic or static import of `PATCH`.
- **Do not invent an app-layer approved check** to “make unit testing easier” — approved-assign truth remains RLS; tests only lock the remapped message.

## Phase 1: Risk #3 — Admin PATCH denial

### Overview

Prove non-admin cannot approve or reject via admin `PATCH`, with `update` never reached. Keep `requireAdmin` units as the shared-helper floor.

### Changes Required:

#### 1. Admin PATCH handler tests

**File**: `src/pages/api/admin/catalog/[id].test.ts` (or `src/lib/admin-catalog-patch.test.ts` if colocating next to a thin extracted wrapper — prefer route-adjacent test with mocks)

**Intent**: Lock Risk #3 prove criteria: non-admin (and null profile) attempting status mutation gets 403 Forbidden JSON; catalog service `update` is not called. Cover both `approved` and `rejected` bodies.

**Contract**:
- Behavior asserted: HTTP 403 + `{ error: "Forbidden" }` for `profile.role === "user"` and `profile: null` on `PATCH` with `{ status: "approved" }` and `{ status: "rejected" }`.
- Regression caught: removing `requireAdmin` from `PATCH` (or returning null for non-admin) fails the test; approving would otherwise reach `update`.
- Research source: `research.md` Risk #3; `[id].ts:49-85`.
- Edge: valid UUID `params.id` so failure is authz, not validation; invalid JSON / validation paths are out of scope for this phase.
- Anti-pattern avoided: HTML `/admin` rewrite; middleware-only predicate test; asserting only `requireAdmin` in isolation as “done” for #3 (helper tests remain but are not sufficient alone).

#### 2. Keep helper regression suite

**File**: `src/lib/require-admin.test.ts` (no required logic change)

**Intent**: Ensure Phase 1 helper floor stays green alongside handler tests.

**Contract**: Existing three cases still pass under `npm test`.

### Success Criteria:

#### Automated Verification:

- Non-admin `PATCH` approve → 403 `{ error: "Forbidden" }` and `update` not called
- Non-admin `PATCH` reject → same
- Null-profile `PATCH` approve → 403 and `update` not called
- `requireAdmin` unit suite still passes
- `npm test` and `npm run lint` pass

#### Manual Verification:

- Suite titles name admin mutation denial / cannot-approve (not “admin happy path”)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Risk #4 — Assignment rules

### Overview

Export and unit the demotion rule; prove it on both service call sites; lock non-approved assign **error mapping** (not RLS itself).

### Changes Required:

#### 1. Export demotion helper

**File**: `src/lib/services/assignments.ts`

**Intent**: Make the pure library→wishlist guard testable as an independent oracle without mirroring UI.

**Contract**: Export `assertNotLibraryToWishlist` (keep existing throw: `AssignmentServiceError` `"forbidden"`, message `"Cannot move a library item to wishlist"`). Call sites in `assign` / `updateListType` unchanged in behavior.

#### 2. Demotion + promote unit tests

**File**: `src/lib/services/assignments.test.ts`

**Intent**: Prove library→wishlist rejected; wishlist→library allowed; both `updateListType` and `assign` upsert paths enforce demotion.

**Contract**:
- Behavior asserted: pure export throws on `library`→`wishlist`; does not throw on `wishlist`→`library` or same-type no-ops.
- Via `updateListType`: existing row `library`, target `wishlist` → throws forbidden; no `.update` on the mock.
- Via `assign` upsert path: after simulated `23505` + existing `library` row, target `wishlist` → throws forbidden before update.
- Wishlist→library via `updateListType` proceeds (mock allows update or returns updated row) without demotion error.
- Research source: `research.md` Risk #4; `assignments.ts:91-96,188,244`.
- Edge: same list_type no-op does not throw demotion.
- Anti-pattern avoided: asserting React button absence; using UI state machine as oracle.

#### 3. Non-approved assign mapping unit

**File**: `src/lib/services/assignments.test.ts` (same suite or clearly named `describe`)

**Intent**: Lock the user-facing forbidden message when PostgREST/RLS-style insert failures occur — without claiming the DB policy is tested.

**Contract**:
- Behavior asserted: `assign` insert error with code `42501` and/or message containing `permission` / `policy` / `row-level security` → `AssignmentServiceError` `forbidden` with message `"Cannot assign to a non-approved catalog item"`.
- Optionally one 23505 + no visible existing row path → same message (`assignments.ts:183-185`).
- Document in test name/comment: **mapping oracle, not RLS**.
- Research source: `assignments.ts:212-219`; RLS policy cited in research only as production truth.
- Anti-pattern avoided: inventing `if (status !== "approved")` in app code to make the test green; treating mapping green as RLS green.

#### 4. Extend query mock if needed

**File**: `src/lib/services/__tests__/supabase-query-mock.ts`

**Intent**: Support assign upsert sequencing (insert error → select existing → optional update) without over-building.

**Contract**: Minimal extensions only for Phase 2 scenarios; reuse patterns from catalog tests.

### Success Criteria:

#### Automated Verification:

- Pure demotion export tests pass (reject + allow cases)
- `updateListType` demotion test passes without calling update
- `assign` upsert demotion test passes
- Wishlist→library path does not throw demotion error
- Non-approved mapping unit(s) pass with fixed message
- `npm test` and `npm run lint` pass

#### Manual Verification:

- Confirm no new test asserts cross-user assignment IDs (Risk #2 still absent)
- Confirm no test asserts CatalogItemActions button labels as protection

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Cookbook + handoff

### Overview

Document shipped patterns in test-plan §6; record Phase 2 note; leave §1–§2 untouched aside from §3 status (orchestrator may already say `researched`/`planned`).

### Changes Required:

#### 1. Cookbook updates

**File**: `context/foundation/test-plan.md`

**Intent**: Teach future agents how to add admin mutation and assignment-rule tests without UI/middleware-alone mistakes.

**Contract**:
- §6.4: document mocked route/`PATCH` pattern for admin mutation denial (in addition to helper units); warn about `astro:env` and `vi.mock` ordering.
- §6.1 or new bullet under services: assignment demotion + mapping reference `assignments.test.ts`.
- §6.2 / §6.5: remain TBD for true session/RLS CI; note mapping unit ≠ RLS proof.
- §6.6: add Phase 2 (`testing-authz-assignment-rules`) shipped note; restate Risk #2 not absorbed.
- Do not rewrite §2 risk rows in this change (optional guidance tweaks → `/10x-test-plan` backport or `--refresh`).

#### 2. AGENTS.md touch only if needed

**File**: `AGENTS.md`

**Intent**: Point at new reference tests if the testing section lists examples.

**Contract**: Minimal — add `assignments.test.ts` / admin PATCH test path if examples are enumerated; otherwise skip.

### Success Criteria:

#### Automated Verification:

- `npm test`, `npm run lint`, `npm run build` pass
- §6 no longer TBD-only for the patterns this change shipped

#### Manual Verification:

- Read §6.4 + §6.6: instructions match files; Risk #2 deferral explicit
- §2 risk map body unchanged

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- Admin `PATCH` non-admin/null → 403; `update` not called (approve + reject)
- `requireAdmin` regression
- Exported demotion helper + `updateListType` / `assign` demotion paths
- Wishlist→library allowed
- Non-approved assign error mapping

### Integration Tests:

- None (no Docker RLS / session suite in this change)

### Manual Testing Steps:

1. Run `npm test` — confirm new files listed green
2. Temporarily remove `requireAdmin` from `PATCH` — expect handler test fail; restore
3. Confirm no UI-component tests added for demotion

## Performance Considerations

Suite should remain sub-second on Node Vitest; no Worker pool.

## Migration Notes

N/A — no schema changes. Exporting `assertNotLibraryToWishlist` is a small public API addition for tests/callers; behavior unchanged.

## References

- Research: `context/changes/testing-authz-assignment-rules/research.md`
- Test plan: `context/foundation/test-plan.md` §2 Risks #3/#4, §3 Phase 2
- Phase 1 prior: `context/changes/testing-critical-path-bootstrap/plan.md`
- `src/pages/api/admin/catalog/[id].ts:49-85`
- `src/lib/require-admin.ts:21-25`
- `src/lib/services/assignments.ts:91-96,183-219,244`
- `src/middleware.ts:68-78` (context only — not the prove surface)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Risk #3 — Admin PATCH denial

#### Automated

- [x] 1.1 Non-admin `PATCH` approve → 403 `{ error: "Forbidden" }` and `update` not called — c297c94
- [x] 1.2 Non-admin `PATCH` reject → 403 and `update` not called — c297c94
- [x] 1.3 Null-profile `PATCH` approve → 403 and `update` not called — c297c94
- [x] 1.4 `requireAdmin` unit suite still passes — c297c94
- [x] 1.5 `npm test` and `npm run lint` pass — c297c94

#### Manual

- [x] 1.6 Suite titles name admin mutation denial / cannot-approve — c297c94

### Phase 2: Risk #4 — Assignment rules

#### Automated

- [x] 2.1 Pure demotion export tests pass (reject + allow)
- [x] 2.2 `updateListType` demotion test passes without calling update
- [x] 2.3 `assign` upsert demotion test passes
- [x] 2.4 Wishlist→library path does not throw demotion error
- [x] 2.5 Non-approved mapping unit(s) pass with fixed message
- [x] 2.6 `npm test` and `npm run lint` pass

#### Manual

- [x] 2.7 No cross-user IDOR tests added (Risk #2 absent)
- [x] 2.8 No UI button-label tests used as demotion oracle

### Phase 3: Cookbook + handoff

#### Automated

- [ ] 3.1 `npm test`, `npm run lint`, and `npm run build` pass
- [ ] 3.2 test-plan §6 documents shipped admin PATCH + assignment patterns

#### Manual

- [ ] 3.3 §6.4 + §6.6 match files; Risk #2 deferral explicit
- [ ] 3.4 §2 risk map body unchanged
