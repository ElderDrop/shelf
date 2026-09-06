---
change_id: testing-critical-path-bootstrap
title: Testing critical path bootstrap
status: impl_reviewed
created: 2026-08-31
updated: 2026-09-01
archived_at: null
---

## Notes

Frame brief reframes Phase 1 away from bundling Risk #2 (assignment IDOR).
Leading problem: non-admin must not observe pending/rejected catalog items
on reachable surfaces. See frame.md.
Plan: Vitest + listApproved .eq oracle + shared requireAdmin 403 + CI + cookbook.
Plan review 2026-08-31: SOUND after triage (F1–F4 fixed).
Implemented 2026-09-01 (commits b2a534a, f73d181, 3287b04).
Impl review 2026-09-01: APPROVED (see reviews/impl-review.md).
