# Catalog Schema and RLS Implementation Plan

## Overview

Land the first Shelf domain migration in Supabase: catalog items with an approval gate, per-user library/wishlist assignments, an admin role distinction, and RLS policies that enforce the PRD guardrail — unapproved catalog rows are invisible to regular users. This foundation unlocks S-01 (admin catalog CRUD/approval) and S-02 (user search and assign).

## Current State Analysis

The repo has Supabase Auth wired (`src/lib/supabase.ts`, cookie SSR client with anon key) and middleware that resolves `context.locals.user`, but **no domain tables, migrations, or RLS policies exist**. `supabase/migrations/` is absent; `src/types.ts` does not exist. All catalog/library/wishlist/admin requirements live in product docs only.

### Key Discoveries:

- `createClient` uses the **anon key** with user sessions — all future user-facing queries will run under RLS (`src/lib/supabase.ts:5-23`).
- Middleware only guards `/dashboard` for login; **no admin role check** exists in app code yet (`src/middleware.ts:4-21`).
- Repo convention: migrations in `supabase/migrations/YYYYMMDDHHmmss_description.sql`, RLS enabled on every new table with granular per-operation policies (`CLAUDE.md:39`).
- Infrastructure pre-mortem warns against late RLS and service-role foot-guns; this change establishes RLS before any user-facing catalog routes (`context/foundation/infrastructure.md:84`).

## Desired End State

After this plan completes:

1. Three domain tables exist: `profiles` (role), `catalog_items` (pending/approved/rejected + metadata), `user_assignments` (library/wishlist per user).
2. RLS is enabled on all three tables with policies that:
   - Let regular users **SELECT only `approved` catalog items**.
   - Let admins **SELECT/INSERT/UPDATE/DELETE all catalog items** regardless of status.
   - Let users **manage only their own assignments**, and only for **approved** catalog items.
   - Prevent users from reading or modifying other users' assignments.
3. A reusable `is_admin()` SQL helper drives admin policies.
4. New users automatically get a `profiles` row with `role = 'user'`.
5. Shared TypeScript entity types in `src/types.ts` match the schema for downstream slices.
6. Manual RLS verification confirms unapproved rows cannot leak to non-admin sessions.

**Verification:** `npx supabase db reset` applies the migration cleanly; manual SQL checks (documented below) pass for admin vs user vs unauthenticated roles.

## What We're NOT Doing

- Admin UI, API routes, or middleware admin guards (S-01).
- User catalog search/assign endpoints or pages (S-02).
- Seed data or production admin bootstrap automation (S-01 open question).
- `SUPABASE_SERVICE_ROLE_KEY` env wiring or service-role client (S-03 metadata enrichment).
- Share-link tokens or public read paths (S-05).
- Enrichment/scrape job tables or audit logs beyond `created_at`/`updated_at` (S-03).
- Supabase CLI type generation (`supabase gen types`) — hand-written types are sufficient for three tables.
- Full-text search indexes or media-type columns (defer until search slice needs them).

## Implementation Approach

Single ordered migration establishing enums → tables → indexes → triggers → `is_admin()` helper → RLS policies. Split into three phases for review checkpoints: schema DDL, RLS policies, then TypeScript types plus verification.

**Key design choices (defaults applied — no upstream frame/research):**

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Admin role storage | `profiles.role` enum (`user` \| `admin`) | Standard Supabase pattern; no JWT hook config needed for single admin MVP |
| Catalog approval states | `pending`, `approved`, `rejected` | Matches FR-006 approve/reject; rejected items stay admin-only |
| Tags | `text[]` on `catalog_items` | Sufficient for FR-007 tag-overlap recommendations at MVP scale |
| Assignments | Single `user_assignments` table with `list_type` enum | One row per user+catalog item; user picks library or wishlist |
| Profile bootstrap | Trigger on `auth.users` INSERT | Every signup gets a profile without app code |

## Phase 1: Schema DDL

### Overview

Create enums, tables, indexes, `updated_at` triggers, profile auto-provisioning, and the `is_admin()` helper. No RLS policies yet — tables are created with RLS **enabled** but no policies until Phase 2 (Supabase denies all access until policies are added; migration applies in one transaction so this is safe).

### Changes Required:

#### 1. Initial migration file

**File**: `supabase/migrations/20260608120000_catalog_schema.sql`

**Intent**: Define the complete Shelf domain schema — enums, `profiles`, `catalog_items`, `user_assignments`, supporting indexes, `updated_at` triggers, signup profile provisioning, and `is_admin()` — as the repo's first domain migration precedent.

**Contract**:

- **Enums**: `app_role` (`user`, `admin`); `catalog_status` (`pending`, `approved`, `rejected`); `list_type` (`library`, `wishlist`).
- **`profiles`**: `id uuid PK → auth.users(id) ON DELETE CASCADE`, `role app_role NOT NULL DEFAULT 'user'`, `created_at`, `updated_at`.
- **`catalog_items`**: `id uuid PK DEFAULT gen_random_uuid()`, `title text NOT NULL`, `description text`, `tags text[] NOT NULL DEFAULT '{}'`, `status catalog_status NOT NULL DEFAULT 'pending'`, timestamps.
- **`user_assignments`**: `id uuid PK`, `user_id → auth.users`, `catalog_item_id → catalog_items`, `list_type list_type NOT NULL`, `created_at`, `UNIQUE (user_id, catalog_item_id)`.
- **Indexes**: `catalog_items(status)`; GIN on `catalog_items.tags`; `user_assignments(user_id, list_type)`.
- **`updated_at` trigger**: reusable trigger function + triggers on `profiles` and `catalog_items`.
- **Profile provisioning**: `AFTER INSERT ON auth.users` trigger creates `profiles` row with `role = 'user'`.
- **`is_admin()`**: `SECURITY DEFINER`, `STABLE`, checks `profiles.role = 'admin'` for `auth.uid()`; `GRANT EXECUTE` to `authenticated`.
- **RLS**: `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` on all three tables (policies added in Phase 2).

### Success Criteria:

#### Automated Verification:

- Migration file exists at `supabase/migrations/20260608120000_catalog_schema.sql`
- `npm run lint` passes (no app code changes expected, but confirms repo health)
- `npm run build` passes

#### Manual Verification:

- With local Supabase running (`npx supabase start`), `npx supabase db reset` completes without SQL errors
- `\d profiles`, `\d catalog_items`, `\d user_assignments` in `psql` show expected columns and constraints
- New signup via existing auth flow creates a `profiles` row automatically

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: RLS Policies

### Overview

Add granular per-operation RLS policies on all three tables. This is the load-bearing security layer for the PRD approval gate.

### Changes Required:

#### 1. RLS policies in migration (same file or follow-up migration)

**File**: `supabase/migrations/20260608120000_catalog_schema.sql` (append policies to the same migration if Phase 1 not yet committed; otherwise `supabase/migrations/20260608130000_catalog_rls.sql`)

**Intent**: Enforce approved-only catalog visibility for regular users, full catalog management for admins, and per-user assignment isolation with approved-item guard on writes.

**Contract**:

**`profiles`**:
- `SELECT`: own row (`id = auth.uid()`) OR `is_admin()`
- `UPDATE`: own row only, **cannot change `role`** (column not in `WITH CHECK` for self-update — implement via policy that excludes `role` changes for non-admin, or restrict UPDATE to `authenticated` where `id = auth.uid()` with no role column update; admins update roles via service role / manual SQL in S-01)

**`catalog_items`**:
- `SELECT` (authenticated): `status = 'approved'` OR `is_admin()`
- `INSERT`: `is_admin()`
- `UPDATE`: `is_admin()`
- `DELETE`: `is_admin()`
- No policies for `anon` role (unauthenticated users see nothing)

**`user_assignments`**:
- `SELECT`: `user_id = auth.uid()`
- `INSERT`: `user_id = auth.uid()` AND `EXISTS (SELECT 1 FROM catalog_items WHERE id = catalog_item_id AND status = 'approved')`
- `UPDATE`: `user_id = auth.uid()` (same approved-item check in `WITH CHECK` if `catalog_item_id` can change — prefer making `catalog_item_id` immutable after insert)
- `DELETE`: `user_id = auth.uid()`

Use separate named policies per operation (repo convention: granular per-operation, per-role).

### Success Criteria:

#### Automated Verification:

- `npx supabase db reset` applies cleanly with policies included
- `npm run lint` and `npm run build` still pass

#### Manual Verification:

- **User session**: `SELECT` on `catalog_items` returns only `approved` rows; `pending`/`rejected` invisible
- **Admin session** (after `UPDATE profiles SET role = 'admin'`): `SELECT` returns all statuses; can INSERT/UPDATE/DELETE catalog items
- **User session**: cannot `SELECT` another user's assignments; cannot INSERT assignment for `pending` catalog item
- **Unauthenticated** (`anon`): no rows from any table
- **Cross-user leak test**: User A cannot read User B's assignments

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: TypeScript Types and Documentation

### Overview

Add shared entity types for downstream slices and update stale README guidance about migrations.

### Changes Required:

#### 1. Domain entity types

**File**: `src/types.ts`

**Intent**: Provide typed contracts for catalog items, assignments, and profiles that S-01/S-02 can import without waiting for codegen setup.

**Contract**: Export types/interfaces matching DB columns — `AppRole`, `CatalogStatus`, `ListType`, `Profile`, `CatalogItem`, `UserAssignment` — using string union types for enums and `string` for UUID fields.

#### 2. README migration note

**File**: `README.md`

**Intent**: Replace the starter-era statement that no migrations are required with a pointer to `supabase/migrations/` and `npx supabase db reset` for local schema setup.

**Contract**: Update the Supabase/database section only; do not rewrite unrelated README content.

#### 3. RLS verification script (optional helper)

**File**: `supabase/tests/rls_catalog.sql` (or document inline in plan — prefer a small SQL file for repeatability)

**Intent**: Provide copy-pasteable SQL snippets that simulate user vs admin JWT claims for manual RLS regression checks during S-01 development.

**Contract**: Comments + `SET LOCAL request.jwt.claim.sub` patterns (or `supabase test` compatible structure if CLI supports it); at minimum document the verification queries in this file.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes with new `src/types.ts`
- `npm run build` passes

#### Manual Verification:

- Types import cleanly from a scratch import in `src/pages/dashboard.astro` or a throwaway check (no need to persist UI usage)
- README accurately describes migration workflow

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

No test runner exists in the repo. Schema correctness is verified via migration apply + manual RLS SQL checks.

### Integration Tests:

Deferred to S-01 when first API routes query these tables under real sessions.

### Manual Testing Steps:

1. `npx supabase start` then `npx supabase db reset`
2. Sign up two users via `/auth/signup` (User A, User B)
3. In SQL editor, promote one user: `UPDATE profiles SET role = 'admin' WHERE id = '<admin-uuid>'`
4. As admin (SQL with admin JWT or Supabase dashboard impersonation): INSERT catalog items with `pending` and `approved` statuses
5. As User A (authenticated client or SQL with user JWT): verify only `approved` catalog items visible
6. As User A: INSERT assignment to approved item → success; to pending item → denied
7. As User B: verify User A's assignments are not visible
8. Sign out / anon: verify no catalog or assignment access

## Performance Considerations

MVP data volume is small (PRD target_scale). `catalog_items(status)` and GIN on `tags` are sufficient for S-02 search. No pagination indexes needed yet.

## Migration Notes

- **Local**: `npx supabase db reset` after adding migration files.
- **Deploy gate (Phase 1)**: Do not push this migration to production until Phase 2 RLS policies ship in the same deploy. RLS is enabled with no policies — fail-closed (no leakage, but all table access denied for `anon`/`authenticated` until policies exist).
- **Production**: Apply via `supabase db push` or linked project migration deploy — human approval required per `infrastructure.md`. Worker deploy does not roll back DB changes.
- **Admin bootstrap**: First admin is set manually (`UPDATE profiles SET role = 'admin' WHERE id = ...`). Document the UUID lookup (`SELECT id, email FROM auth.users`) in S-01; not automated here.
- **Existing auth users**: If any exist before migration, run a one-time backfill `INSERT INTO profiles (id) SELECT id FROM auth.users ON CONFLICT DO NOTHING` in the migration.

## References

- PRD access control: `context/foundation/prd.md` (Access Control, FR-006, guardrails)
- Roadmap F-01: `context/foundation/roadmap.md`
- Migration conventions: `CLAUDE.md`, `AGENTS.md`
- Supabase client pattern: `src/lib/supabase.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Schema DDL

#### Automated

- [x] 1.1 Migration file exists at `supabase/migrations/20260608120000_catalog_schema.sql`
- [x] 1.2 `npm run lint` passes
- [x] 1.3 `npm run build` passes

#### Manual

- [x] 1.4 `npx supabase db reset` completes without SQL errors
- [x] 1.5 Table definitions and signup profile trigger verified in psql
- [x] 1.6 New signup creates a `profiles` row automatically

### Phase 2: RLS Policies

#### Automated

- [x] 2.1 `npx supabase db reset` applies policies cleanly — b5b1fa9
- [x] 2.2 `npm run lint` passes — b5b1fa9
- [x] 2.3 `npm run build` passes — b5b1fa9

#### Manual

- [x] 2.4 User session sees only approved catalog items — b5b1fa9
- [x] 2.5 Admin session sees and manages all catalog statuses — b5b1fa9
- [x] 2.6 Assignment isolation and approved-only insert guard verified — b5b1fa9
- [x] 2.7 Unauthenticated access returns no domain rows — b5b1fa9

### Phase 3: TypeScript Types and Documentation

#### Automated

- [x] 3.1 `npm run lint` passes with `src/types.ts`
- [x] 3.2 `npm run build` passes

#### Manual

- [x] 3.3 Entity types align with migration columns
- [x] 3.4 README migration guidance updated
