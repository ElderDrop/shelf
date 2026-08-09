# F3 — Phase 1 Manual Verification Guide

Resolves **impl-review F3** and plan Progress steps **1.4–1.6**. Run this on a machine with Docker before starting Phase 2.

**Related**: `context/changes/catalog-schema-rls/plan.md` (Phase 1), `supabase/migrations/20260608120000_catalog_schema.sql`

---

## Prerequisites

- Docker running (`docker info` succeeds)
- Node v22.14.0 (see `.nvmrc`)
- Repo dependencies installed (`npm ci`)
- `.dev.vars` (and optionally `.env`) with local Supabase credentials

---

## Step 0 — One-time env setup

```bash
cd /path/to/10x

# Start local Supabase (first run downloads images; may take a few minutes)
npx supabase start
```

Copy the **API URL** and **anon key** from the CLI output into `.dev.vars`:

```env
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_KEY=<anon key from supabase start output>
```

Optional: mirror the same values in `.env` if you use deploy scripts locally.

Verify Studio is up: http://localhost:54323

---

## Step 1.4 — `db reset` applies migration cleanly

```bash
npx supabase db reset
```

**Pass criteria**

- Command exits `0`
- No SQL errors in output
- Migration `20260608120000_catalog_schema.sql` appears in the apply log
- Seed step completes (empty `supabase/seed.sql` is fine)

**If it fails**

- `Cannot connect to Docker` → start Docker, retry
- `seed.sql` missing → ensure `supabase/seed.sql` exists (added in F4 fix)
- SQL syntax error → fix migration, rerun `db reset`

---

## Step 1.5 — Table definitions in SQL

**Option A — Studio (easiest):** open **SQL Editor** at http://localhost:54323

**Option B — CLI one-shots** (Supabase CLI v2.108+; `db connect` was removed):

```bash
# Schema audit (paste the full query from the chat / plan review)
npx supabase db query --local --file path/to/check.sql

# Or inline:
npx supabase db query --local "SELECT tablename FROM pg_tables WHERE schemaname = 'public';"
```

**Option C — psql interactive** (`\d` meta-commands need this):

```bash
npx supabase status -o env | grep DB_URL
# Then connect, e.g.:
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
```

In **psql** only, run inspect commands like:

```sql
\d public.profiles
\d public.catalog_items
\d public.user_assignments
\dT+ public.app_role
\dT+ public.catalog_status
\dT+ public.list_type
```

### Expected: `profiles`

| Check | Expected |
|-------|----------|
| Columns | `id uuid PK`, `role app_role NOT NULL DEFAULT 'user'`, `created_at`, `updated_at` |
| FK | `id` → `auth.users(id)` ON DELETE CASCADE |
| Trigger | `profiles_set_updated_at` (BEFORE UPDATE) |
| RLS | enabled (no policies yet — deny-by-default for client roles) |

### Expected: `catalog_items`

| Check | Expected |
|-------|----------|
| Columns | `id uuid PK`, `title text NOT NULL`, `description text`, `tags text[] NOT NULL DEFAULT '{}'`, `status catalog_status NOT NULL DEFAULT 'pending'`, timestamps |
| Indexes | `catalog_items_status_idx`, `catalog_items_tags_idx` (GIN) |
| Trigger | `catalog_items_set_updated_at` |
| RLS | enabled |

### Expected: `user_assignments`

| Check | Expected |
|-------|----------|
| Columns | `id uuid PK`, `user_id`, `catalog_item_id`, `list_type list_type NOT NULL`, `created_at` |
| FKs | `user_id` → `auth.users`, `catalog_item_id` → `catalog_items` (both CASCADE) |
| Unique | `(user_id, catalog_item_id)` |
| Indexes | `user_assignments_user_list_idx`, `user_assignments_catalog_item_id_idx` |
| RLS | enabled |

### Expected: helper objects

```sql
-- Trigger on auth.users for profile provisioning
SELECT tgname FROM pg_trigger
WHERE tgname = 'on_auth_user_created';

-- is_admin() exists and is not PUBLIC-executable
SELECT proname, proacl FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND proname = 'is_admin';
```

**Pass criteria**: All three tables match the contract above; enums exist; `on_auth_user_created` trigger present.

---

## Step 1.6 — Signup creates a `profiles` row

### Option A — App signup (preferred)

1. Start the dev server:

   ```bash
   npm run dev
   ```

2. Open http://localhost:4321/auth/signup (or your dev port).

3. Register a new user with a fresh email (e.g. `phase1-test+1@example.com`).

4. Confirm in SQL:

   ```sql
   SELECT u.id, u.email, p.role, p.created_at
   FROM auth.users u
   LEFT JOIN public.profiles p ON p.id = u.id
   WHERE u.email = 'phase1-test+1@example.com';
   ```

   **Pass**: one row; `p.role = 'user'`; `p.id = u.id`; `p.created_at` is set.

### Option B — Studio / SQL only

If email confirmation blocks local signup, insert via SQL to simulate auth signup:

```sql
-- Only for local verification; app flow is Option A
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'manual-trigger-test@example.com',
  crypt('local-dev-password', gen_salt('bf')),
  now(), now(), now()
);

SELECT id, role FROM public.profiles
WHERE id = (SELECT id FROM auth.users WHERE email = 'manual-trigger-test@example.com');
```

**Pass**: profile row exists with `role = 'user'`.

### RLS note (expected behavior)

Direct `SELECT` on domain tables as `anon`/`authenticated` returns **no rows** until Phase 2 policies land. That is correct fail-closed behavior — it is **not** a Phase 1 failure. Profile provisioning uses `handle_new_user()` (`SECURITY DEFINER`), so it bypasses RLS.

---

## Step 2 — Check off Progress

In `context/changes/catalog-schema-rls/plan.md`, update:

```markdown
#### Manual

- [x] 1.4 `npx supabase db reset` completes without SQL errors
- [x] 1.5 Table definitions and signup profile trigger verified in psql
- [x] 1.6 New signup creates a `profiles` row automatically
```

Optionally append a short note with date and your machine context.

---

## Step 3 — Close F3 in impl-review

In `context/changes/catalog-schema-rls/reviews/impl-review.md`, update F3:

```markdown
- **Decision**: FIXED — manual verification complete (steps 1.4–1.6); verified on <YYYY-MM-DD>.
```

Update the **Triage Summary** pending line to reflect F3 fixed.

---

## Quick checklist

- [ ] Docker running
- [ ] `npx supabase start` OK
- [ ] `.dev.vars` has local `SUPABASE_URL` + `SUPABASE_KEY`
- [ ] `npx supabase db reset` exits 0
- [ ] `\d` checks match expected schema
- [ ] Signup (or trigger test) creates `profiles` row
- [ ] Plan Progress 1.4–1.6 checked off
- [ ] impl-review F3 marked FIXED

---

## After completion

Phase 1 gate is clear. Proceed to **Phase 2: RLS Policies** in the plan (`/10x-implement` or manual migration append).

**Deploy reminder**: Do not push Phase 1 alone to production — Phase 2 policies must ship in the same deploy (see migration DEPLOY GATE comment and plan Migration Notes).
