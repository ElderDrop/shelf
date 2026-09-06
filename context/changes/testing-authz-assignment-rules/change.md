---
change_id: testing-authz-assignment-rules
title: Testing authz and assignment rules
status: impl_reviewed
created: 2026-09-03
updated: 2026-09-06
archived_at: null
---

## Notes

Open a change folder for rollout Phase 2 of context/foundation/test-plan.md: "Authz & assignment rules".
Risks covered: #3 (non-admin reaches admin catalog write/approve paths), #4 (assignment rules break: non-approved assign or library→wishlist demotion). Test types planned: integration + focused unit.
Risk response intent: #3 — Non-admin gets 403 on admin mutations and cannot approve items (challenge: middleware alone proves the admin gate; avoid only testing HTML /admin redirect). #4 — Assign to non-approved fails; library→wishlist rejected; wishlist→library OK (challenge: client-disabled control equals server rule; avoid mirroring UI state machine as the test oracle).
After creating the folder, follow the downstream continuation rule.

Research 2026-09-03: see research.md — #3 multi-gate (middleware + requireAdmin + RLS); Phase 1 helper units incomplete for mutations. #4 demotion app-pure; approved-assign is RLS + error mapping. Risk #2 stays deferred.

Plan 2026-09-03: PATCH handler tests (vi.mock); export demotion helper + both call sites; mapping unit only (no RLS CI); cookbook §6. See plan.md / plan-brief.md.

Implemented 2026-09-06 (commits c297c94, ca4bcba, 8509a67).
Impl review 2026-09-06: APPROVED (see reviews/impl-review.md).
