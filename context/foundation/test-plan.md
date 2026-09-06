# Test Plan

> Phased test rollout for this project. Strategy is frozen at the top
> (§1–§5); cookbook patterns at the bottom (§6) fill in as phases ship.
> Read before writing any new test.
>
> Refresh: re-run `/10x-test-plan --refresh` when stale (see §8).
>
> Last updated: 2026-08-31

## 1. Strategy

Tests follow three non-negotiable principles for this project:

1. **Cost × signal.** The cheapest test that gives a real signal for the
   risk wins. Do not promote to e2e because e2e "feels safer." Do not put a
   vision model on top of a deterministic visual diff that already catches
   the regression.
2. **User concerns are first-class evidence.** Risks anchored in "<the
   team is worried about X, and the failure would surface somewhere in
   <area>>" carry the same weight as PRD lines or hot-spot data.
3. **Risks are scenarios, not code locations.** This plan documents *what
   could fail* and *why we believe it's likely* — drawn from documents,
   interview, and codebase *signal* (churn, structure, test base). It does
   NOT claim to know which line owns the failure. That knowledge is
   produced by `/10x-research` during each rollout phase. If the plan and
   research disagree about where the failure lives, research is the
   ground truth.

Hot-spot scope used for likelihood weighting: `src/`, `supabase/migrations/`.

## 2. Risk Map

The top failure scenarios this project must protect against, ordered by
risk = impact × likelihood. Risks are failure scenarios in user / business
terms, not test names. The Source column cites the *evidence that surfaced
this risk* — never a specific file as "where the failure lives" (that is
research's job, see §1 principle #3).

| # | Risk (failure scenario) | Impact | Likelihood | Source (evidence — not anchor) |
|---|---|---|---|---|
| 1 | Non-admin (or anonymous) sees pending/rejected catalog items in user-facing catalog or search | High | High | Interview Q1; PRD Guardrails + FR-002/006; roadmap F-01/S-01; hot-spot dirs `src/lib/services`, `src/pages` (18 commits/30d scoped) |
| 2 | Authenticated user mutates another user's library/wishlist assignment (ownership miss / IDOR) | High | Medium | Abuse lens; PRD Access Control; archive `catalog-search-assign`; hot-spot dir `src/lib/services` |
| 3 | Non-admin reaches admin catalog write/approve paths and changes catalog status | High | Medium | PRD Access Control + FR-004/006; archive `admin-catalog-approval`; hot-spot dirs `src/components/admin`, `src/pages/api` |
| 4 | Assignment rules break: non-approved assign succeeds, or library→wishlist demotion is allowed | Medium | High | Archive `catalog-search-assign` desired end state; hot-spot dir `src/lib/services` |
| 5 | Share-link recipient can edit or delete the owner's library/wishlist (when S-05 lands) | High | Medium | Interview Q1; PRD FR-008 + NFR; roadmap S-05 proposed |
| 6 | Recommendations surface unapproved items, ignore the ≥3 tagged-library gate, or include already-assigned items | Medium | Medium | PRD FR-007 + secondary criteria; archive `tag-recommendations`; hot-spot dir `src/lib` |

### Risk Response Guidance

| Risk | What would prove protection | Must challenge | Context `/10x-research` must ground | Likely cheapest layer | Anti-pattern to avoid |
|------|-----------------------------|----------------|--------------------------------------|-----------------------|-----------------------|
| #1 | User-role session listing/searching catalog never returns pending or rejected items | "Approved-only UI" equals server/RLS filter | Session role, list/search entry points, status filter boundary | Integration (session + DB/RLS or service contract) | Asserting only against a mocked approved array copied from production query |
| #2 | User B cannot update or delete User A's assignment IDs | "Logged in" equals "owns the row" | Assignment mutate API shape, ownership check vs RLS | Integration / API contract | Happy-path only with self-owned IDs |
| #3 | Non-admin gets 403 on admin mutations; cannot approve items | Middleware alone proves the admin gate | Admin API authz and role source of truth | Integration | Only testing HTML `/admin` redirect |
| #4 | Assign to non-approved fails; library→wishlist rejected; wishlist→library OK | Client-disabled control equals server rule | Assignment POST/PATCH contracts and list-type lock | Unit (pure rule) + thin API integration | Mirroring UI state machine as the test oracle |
| #5 | Recipient with share token: read works; mutate APIs fail | "No edit UI" equals read-only | Share token auth model and mutate surfaces | Contract / thin e2e after S-05 exists | Writing tests against unimplemented share routes |
| #6 | Unapproved never recommended; gate hides list below threshold; assigned items excluded | Live score order from implementation equals correct product order | Scorer inputs, fixed fixtures, exclusion set | Unit (pure scorer) + light integration | Snapshotting live ranked output without fixed fixtures |

## 3. Phased Rollout

Each row is a discrete rollout phase that will open its own change folder
via `/10x-new`. Status moves left-to-right through the values below; the
orchestrator updates Status as artifacts appear on disk.

| # | Phase name | Goal (one line) | Risks covered | Test types | Status | Change folder |
|---|---|---|---|---|---|---|
| 1 | Critical-path bootstrap | Bootstrap runner; prove non-admin cannot see pending/rejected catalog items | #1 | runner + integration (+ RLS/SQL if cheapest) | complete | context/changes/testing-critical-path-bootstrap/ |
| 2 | Authz & assignment rules | Lock admin 403 and library/wishlist business rules | #3, #4 | integration + focused unit | implementing | context/changes/testing-authz-assignment-rules/ |
| 3 | Recommendations fixtures | Golden fixtures for gate, exclusion, and unapproved leak | #6 | unit (+ light integration) | not started | — |
| 4 | Share-link read-only | Recipient cannot mutate owner data (after S-05) | #5 | contract / thin e2e | not started | — |
| 5 | Quality-gates wiring | Harden test CI beyond early `npm test` gate (wired in Phase 1) | #1–#4 (lock-in) | CI gate | not started | — |

## 4. Stack

The classic test base for this project. AI-native tools (if any) carry a
`checked:` date so future readers can see which lines need re-verification.

| Layer | Tool | Version | Notes |
|------|------|---------|-------|
| unit + integration | Vitest | 4.x | Node env; `src/**/*.{test,spec}.ts`; see §6.1 / `vitest.config.ts` |
| API mocking | hand-rolled query fake | — | `src/lib/services/__tests__/supabase-query-mock.ts` for PostgREST chains |
| e2e | none yet — see §3 Phase 4 | — | Prefer cheaper layers first; browser MCP available for smoke, not default |
| accessibility | none | — | Out of scope for this rollout |
| (optional) AI-native | not planned | n/a | Cost × signal did not justify a dedicated AI-native phase |

**Stack grounding tools (current session):**
- Docs: none — Context7 / framework docs MCP not available in current session; checked: 2026-08-31
- Search: none — Exa.ai not available in current session; checked: 2026-08-31
- Runtime/browser: cursor-ide-browser — available for future smoke/e2e verification; not used for strategy write; checked: 2026-08-31
- Provider/platform: none — GitHub MCP not available in current session; CI gate design uses existing workflow knowledge from AGENTS.md; checked: 2026-08-31

## 5. Quality Gates

The full set of gates that must pass before a change reaches production.
"Required for §3 Phase \<N\>" means the gate is enforced once that rollout
phase lands; before that, the gate is `planned`.

| Gate | Where | Required? | Catches |
|------|-------|-----------|---------|
| lint + typecheck (via lint/build) | local + CI | required (today) | syntactic / type drift |
| unit + integration | local + CI | required (wired early in §3 Phase 1 change; Phase 5 may harden further) | approval-gate filter, admin gate 403, later assignment/authz |
| e2e on critical flows | — | optional / after §3 Phase 4 if research says cheaper layers miss | share-link read-only path only when needed |
| pre-prod smoke | manual | optional | environment-specific failures |

## 6. Cookbook Patterns

How to add new tests in this project. Each sub-section is filled in once
the relevant rollout phase ships; before that, the sub-section reads
"TBD — see §3 Phase \<N\>."

### 6.1 Adding a unit test

- **Location**: colocate under `src/` as `*.test.ts` (e.g. `src/lib/services/catalog.test.ts`).
- **Naming**: describe the failure mode in the suite title (e.g. `listApproved pending-visibility filter`).
- **Reference tests**:
  - `src/lib/services/catalog.test.ts` — asserts `.eq("status", "approved")` on the query builder (oracle = filter call, not mocked row contents). Smoke alias check: `src/lib/services/catalog.smoke.test.ts`.
  - `src/lib/services/assignments.test.ts` — demotion rule (`assertNotLibraryToWishlist`) + `updateListType`/`assign` paths; non-approved assign **error mapping** (fixed forbidden message). Do not use UI button labels as the oracle.
- **Run locally**: `npm test` or `npm run test:watch`.
- **Fake client**: reuse `src/lib/services/__tests__/supabase-query-mock.ts` for PostgREST chains (supports sequential `results` and `auth.getUser` via `authUser`).

### 6.2 Adding an integration test

- TBD — session + DB/RLS integration not landed yet. Manual SQL snippets remain in `supabase/tests/rls_catalog.sql` (comment-only; not CI).
- Note: assignment “non-approved” **mapping** units in §6.1 are not session/RLS integration.

### 6.3 Adding an e2e / contract test

- TBD — see §3 Phase 4 for share-link read-only pattern (after S-05).

### 6.4 Adding a test for a new API endpoint

- **Test type**: prefer a Node-safe gate helper, or a mocked route handler when the prove target is a specific mutation.
- **Helper pattern**: shared `requireAdmin` in `src/lib/require-admin.ts`; assert non-admin → 403 `{ "error": "Forbidden" }`. Reference: `src/lib/require-admin.test.ts`.
- **Mutation / route pattern**: admin catalog routes import `@/lib/supabase` (`astro:env/server`). Under Vitest, register `vi.mock("@/lib/supabase")` (and usually `vi.mock` for the service) **before** importing the handler. Call the export (e.g. `PATCH`) with a fake `APIContext` (`locals.profile`, `params`, `request`). Assert 403 and that the mutating service was never called.
- **Reference test**: `src/pages/api/admin/catalog/[id].test.ts` — non-admin/null cannot approve or reject.
- **Anti-patterns**: HTML `/admin` rewrite alone; middleware-only predicate as “done” for write denial; importing the route without mocks (fails on `astro:env`).
- **When to add e2e instead**: only if failure requires full cookie/middleware/Worker path.

### 6.5 Adding RLS / catalog visibility checks

- TBD — runnable RLS CI not landed. App-layer approved filter is covered in §6.1; DB oracle still manual via `supabase/tests/rls_catalog.sql`.
- Assignment approved-only insert is enforced by RLS in production; the Vitest mapping units lock the remapped error string only — **mapping green ≠ RLS green**.

### 6.6 Per-rollout-phase notes

- **§3 Phase 1 (`testing-critical-path-bootstrap`)**: Shipped Vitest (Node), `listApproved` `.eq("status","approved")` oracle, shared `requireAdmin` 403 unit tests, and `npm test` in CI. **Risk #2 (assignment IDOR) deferred by frame** — not in Phase 1 scope; do not treat Phase 2 (#3/#4) as absorbing #2.
- **§3 Phase 2 (`testing-authz-assignment-rules`)**: Shipped admin `PATCH` cannot-approve denial (mocked route), exported demotion helper + service units, non-approved assign mapping units. **Risk #2 still deferred** — not absorbed. Middleware/`requireAdmin` not consolidated; dual-gate JSDoc remains.
- **§3 Phase 5 (quality-gates wiring)**: `npm test` in CI landed early via Phase 1 change; Phase 5 remains `not started` for any further hardening (coverage thresholds, branch protection docs, etc.).

## 7. What We Deliberately Don't Test

Exclusions agreed during the rollout (Phase 2 interview, Q5). Future
contributors should respect these unless the underlying assumption changes.

- **Admin metadata enrichment (S-03 / external providers)** — external service boundary; mocks add little signal and flake easily. Re-evaluate if enrichment becomes a pure local transform with stable fixtures. (Source: interview Q5.)
- **Cross-user library leakage without a share link** — deferred beyond MVP; not in current test budget. Re-evaluate when privacy hardening becomes a slice. (Source: interview Q1.)
- **Admin catalog status/name filter UX** — product backlog, not a shipped regression risk. Re-evaluate when that UI ships. (Source: interview Q2.)
- **Homepage / UI polish visual snapshots** — high churn, low blast radius for MVP. Re-evaluate after S-06 if polish regressions hurt. (Source: cost × signal; roadmap S-06.)

## 8. Freshness Ledger

- Strategy (§1–§5) last reviewed: 2026-08-31
- Stack versions last verified: 2026-08-31
- AI-native tool references last verified: 2026-08-31

Refresh (`/10x-test-plan --refresh`) when:

- a new top-3 risk surfaces from the roadmap or archive,
- a recommended tool's `checked:` date is older than three months,
- the project's tech stack changes (new framework, new test runner),
- §7 negative-space no longer matches what the team believes.
