# Catalog Schema and RLS — Plan Brief

> Full plan: `context/changes/catalog-schema-rls/plan.md`

## What & Why

Shelf needs a database foundation before any catalog or library features ship. This change adds the minimal Supabase schema — catalog items with an admin approval gate, per-user library/wishlist assignments, and an admin role — plus RLS policies that enforce the PRD's primary guardrail: unapproved catalog items must never be visible to regular users.

## Starting Point

The repo has Supabase Auth (cookie SSR, anon key) and middleware login checks, but zero domain migrations, tables, or RLS policies. `supabase/migrations/` does not exist; `src/types.ts` is absent. All catalog concepts live in the PRD and roadmap only.

## Desired End State

Three tables (`profiles`, `catalog_items`, `user_assignments`) exist with RLS enabled. Regular users see only approved catalog items and manage only their own assignments. Admins see and manage all catalog statuses. New signups auto-get a `profiles` row. TypeScript entity types in `src/types.ts` are ready for S-01 and S-02.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|----------|--------|------------------|--------|
| Admin role storage | `profiles.role` enum | Standard Supabase pattern; no JWT hook needed for single admin | Plan |
| Approval states | `pending`, `approved`, `rejected` | Matches FR-006 approve/reject workflow | PRD |
| Tag storage | `text[]` on `catalog_items` | Enough for MVP tag-overlap recommendations | Plan |
| Assignment model | Single table + `list_type` enum | One assignment per user per catalog item (library or wishlist) | Plan |
| Profile bootstrap | Trigger on `auth.users` INSERT | Zero app-code signup handling | Plan |
| Service role / seed data | Out of scope | Deferred to S-01 (bootstrap) and S-03 (enrichment) | Plan |

## Scope

**In scope:**
- First domain migration with enums, tables, indexes, triggers
- `is_admin()` helper function
- Granular RLS policies on all three tables
- Hand-written `src/types.ts` entity types
- README migration note update
- Manual RLS verification steps

**Out of scope:**
- Admin/user API routes and UI (S-01, S-02)
- Production admin bootstrap automation (S-01)
- Service role env and client (S-03)
- Share links, enrichment tables, seed data

## Architecture / Approach

```
auth.users ──1:1── profiles (role: user|admin)
                      │
catalog_items (status: pending|approved|rejected, tags[])
      │
      └── user_assignments (user_id, list_type: library|wishlist)
```

All app queries use the anon key + user session → RLS enforces access. `is_admin()` drives admin-only write policies on `catalog_items`. Users can only assign approved items to their own library/wishlist.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|-------|------------------|----------|
| 1. Schema DDL | Tables, enums, indexes, triggers, `is_admin()` | Missing backfill for pre-existing auth users |
| 2. RLS Policies | Approved-only visibility + assignment isolation | Policy gap leaking pending rows |
| 3. Types & docs | `src/types.ts`, README, verification SQL | Types drift from migration |

**Prerequisites:** Docker for local Supabase (`npx supabase start`); `.dev.vars` with `SUPABASE_URL` and `SUPABASE_KEY`.

**Estimated effort:** ~1–2 sessions across 3 phases.

## Open Risks & Assumptions

- Manual admin promotion (`UPDATE profiles SET role = 'admin'`) is acceptable until S-01 automates or documents bootstrap.
- Pre-existing `auth.users` rows (if any) need a one-time profile backfill in the migration.
- No automated RLS test runner yet — manual SQL verification is the gate.
- Service role will be needed later for background enrichment; must not bypass RLS patterns established here.

## Success Criteria (Summary)

- `npx supabase db reset` applies the migration without errors.
- Regular users cannot see or assign pending/rejected catalog items.
- Admins can manage all catalog statuses; users cannot read each other's assignments.
- `src/types.ts` exports types matching the schema for downstream slices.
wd wd dwea