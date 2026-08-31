# Frame Brief: Critical-path test bootstrap scope

> Framing step before /10x-plan. This document captures what is *actually*
> at issue, separated from what was initially assumed.

## Reported Observation

Shelf has no automated test suite. The leading product fear for this rollout
phase is that a **non-admin can observe pending/rejected catalog items**
somewhere in the product (collector catalog/search and/or admin surfaces).

## Initial Framing (preserved)

- **User's stated cause or approach**: Test-plan §3 Phase 1 should
  bootstrap a runner and prove Risk #1 (approved-only user catalog) **and**
  Risk #2 (assignment mutate IDOR) together via integration (+ RLS/SQL if
  cheapest).
- **User's proposed direction**: Drive change
  `testing-critical-path-bootstrap` through research → plan → implement under
  that combined Phase 1 goal.
- **Pre-dispatch narrowing**: Leading concern is approval-gate leak (#1);
  ownership/IDOR (#2) can wait if the change gets tight. Later narrowing:
  the protected observation is the **symptom** “non-admin sees pending,”
  on **either / both** collector `/catalog` and admin catalog surfaces —
  not limited to one route.

## Dimension Map

The observation could originate at any of these dimensions:

1. **App service filter** — `listApproved` loses `.eq("status","approved")`
   or user pages call `listAll`; UI does not re-check status.
2. **RLS SELECT / `is_admin()`** — DB gate fails so pending rows return at
   PostgREST (also covers assignment embeds and direct table reads).
3. **Wrong surface (admin authz)** — non-admin reaches `/admin` /
   `/api/admin` `listAll` and sees pending status.  ← same *symptom*,
   different risk row (#3) in the test plan
4. **Browse vs search path split** — one path keeps the filter, the other
   drops it (today they share one helper).
5. **Phase scope bundling** — runner + #1 + #2 in one change.  ← initial
   framing

## Hypothesis Investigation

| Hypothesis | Evidence | Verdict |
| --- | --- | --- |
| App service is the user-path regression choke point | `listApproved` + `.eq` at `src/lib/services/catalog.ts:84-90`; `/catalog` calls it (`catalog.astro:20`); UI does not re-filter status; `listAll` is admin-only | STRONG (as regression surface; not broken today; co-gated by RLS) |
| RLS / `is_admin()` is currently wrong in migrations | Policy `status = 'approved' OR is_admin()` at `supabase/migrations/20260608130000_catalog_rls.sql:27-31`; role default/`is_admin`/role-lock hardened; manual checks in `supabase/tests/rls_catalog.sql` | NONE as static defect; STRONG as durable co-gate / cheapest SQL oracle |
| Admin wrong-surface equals Risk #1 | Middleware + `requireAdmin` present (`middleware.ts:70-102`, admin APIs); `listAll` intentionally unfiltered; test-plan maps this to Risk #3 / Phase 2 | STRONG as *related symptom surface*; WEAK as “same failure mode as `/catalog` filter” |
| Browse/search diverge | Same `listApproved(client, q?)` path | NONE today |
| Bundling #2 into this change is a misframe | User narrowed #1-leading; Phase 2 is #3+#4 only — #2 is not absorbed there; mutate IDOR absent from manual RLS SQL | STRONG |

## Narrowing Signals

- Leading concern = approval-gate (#1), not assignment IDOR (#2).
- Protected observation = non-admin seeing pending **regardless of surface**
  (collector and/or admin) — symptom class, not a single route.
- Independent search ranked: (1) RLS-backed paths including embeds /
  direct SELECT; (2) admin authz miss exposing `listAll`; user
  `/catalog` needs dual failure to leak.

## Cross-System Convention

Archive S-01 and the test plan already split **user approved-only
visibility (Risk #1)** from **admin authz (Risk #3)**. Convention treats
them as separate failure modes that can share symptom language (“non-admin
sees pending”). Manual `supabase/tests/rls_catalog.sql` already sketches
approved-only SELECT for regular users — the cheapest oracle for the DB
half of #1.

## Reframed (or Confirmed) Problem Statement

> **The actual problem to plan around is**: Prove that a **non-admin cannot
> observe pending/rejected catalog items on reachable surfaces**, with a
> durable automated (or automated-able) signal — not “bootstrap runner +
> ship Risks #1 and #2 together.”

What changes: center this change on the **pending-visibility symptom
class**. Primary surface is collector catalog/search (app filter + RLS
defense-in-depth). Admin `listAll` exposure is the same *symptom* on a
different gate (authz) — include only if cost × signal allows a cheap
check without turning the change into full Risk #3 / Phase 2. **Defer
Risk #2 (assignment mutate IDOR)**; do not fold it into Phase 2 either
(that phase owns #3/#4).

The initial framing was half-right on #1 and wrong on packing #2 as a
Phase 1 must-ship.

## Confidence

- **HIGH** — strong evidence + matches archive/test-plan convention +
  decisive narrowing (#1 leads; symptom is multi-surface; #2 out)

No further reproduction needed before planning. Research should still
ground cheapest layer (service contract vs RLS SQL vs thin API) before
locking test design.

## What Changes for /10x-plan

Plan `testing-critical-path-bootstrap` around: (1) introduce the test
runner the empty suite needs, (2) prove non-admin pending invisibility on
the user catalog path at the cheapest durable layer(s), (3) optionally a
cheap non-admin-denied-admin-read check if it stays thin, (4) explicitly
out of scope: assignment IDOR (#2), enrichment, share-link. Recommend a
test-plan §3 note or later `--refresh` if Phase 1’s frozen risk list
should drop #2.

## References

- Source files: `src/lib/services/catalog.ts:84-117`,
  `src/pages/catalog.astro:20`,
  `supabase/migrations/20260608130000_catalog_rls.sql:27-31`,
  `src/middleware.ts:70-102`, `supabase/tests/rls_catalog.sql`,
  `context/foundation/test-plan.md` §2–§3
- Related research: none yet (`research.md` not present)
- Investigation: catalog path explore; service / RLS / admin-surface /
  scope-bundle hypotheses; independent pending-visibility scan
