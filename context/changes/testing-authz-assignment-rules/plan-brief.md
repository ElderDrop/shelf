# Testing Authz & Assignment Rules — Plan Brief

> Full plan: `context/changes/testing-authz-assignment-rules/plan.md`
> Research: `context/changes/testing-authz-assignment-rules/research.md`

## What & Why

Automate test-plan Phase 2 Risks #3 and #4: non-admins must not approve catalog items via admin API, and assignment rules must reject library→wishlist demotion and surface a fixed forbidden message for non-approved assigns. Phase 1 only unit-tested `requireAdmin`; that is not enough for #3.

## Starting Point

Vitest + CI already run. Admin routes call `requireAdmin` then supabase/catalog services. Demotion is a private helper; approved-assign is RLS + error remapping. No assignment tests exist. Risk #2 IDOR stays deferred.

## Desired End State

`npm test` proves: non-admin/null `PATCH` approve/reject → 403 and no `update`; demotion throws on both service paths; wishlist→library OK; RLS-style insert errors map to the fixed non-approved message. Cookbook §6 documents the patterns.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| -------- | ------ | ---------------- | ------ |
| #3 prove surface | Handler + fake context (`vi.mock` supabase/catalog) | Locks PATCH denial without workerd; respects `astro:env` import constraint | Plan |
| #3 mutation breadth | PATCH approve + reject only | Primary status-change failure mode; POST shares same gate | Plan |
| #4 demotion | Export helper + both call sites | Independent oracle; UI omission is not proof | Research / Plan |
| Non-approved assign | Mapping unit only (no RLS CI) | Cheap Node signal; do not claim DB policy coverage | Research / Plan |
| Risk #2 | Out of scope | Explicit deferral from Phase 1 / §6.6 | Research |

## Scope

**In scope:** Admin PATCH denial tests; demotion export + units; non-approved mapping units; §6 cookbook updates.

**Out of scope:** IDOR; middleware/workerd e2e; HTML `/admin` as proof; POST admin create test; RLS CI; middleware/`requireAdmin` consolidation; §1–§2 rewrite.

## Architecture / Approach

Node Vitest only. Mock route deps → call `PATCH` with fake locals. Assignment service takes injectable client — extend query mock for upsert sequences. Oracles = HTTP status/body, thrown `AssignmentServiceError`, and “update not called” — never button labels.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| ----- | ---------------- | -------- |
| 1. Admin PATCH denial | Non-admin cannot approve/reject | `astro:env` import without mocks |
| 2. Assignment rules | Demotion + mapping units | Over-claiming RLS from mapping tests |
| 3. Cookbook handoff | §6 patterns + Phase 2 note | Doc drift vs files |

**Prerequisites:** Phase 1 bootstrap (`vitest`, `requireAdmin`, query mock) already on disk.  
**Estimated effort:** ~1–2 sessions across 3 phases.

## Open Risks & Assumptions

- Handler tests prove route-level `requireAdmin`, not middleware `isApiAdmin` in-process — acceptable per locked decision; dual-gate drift remains documented.
- Mapping green ≠ RLS green — cookbook must say so.

## Success Criteria (Summary)

- Non-admin cannot change catalog status via tested `PATCH` path (403 + no update).
- Library cannot demote to wishlist in service tests; wishlist can promote.
- Non-approved assign failures show the fixed forbidden message in mapping units.
