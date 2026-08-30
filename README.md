# 10x Astro Starter

![](./public/template.png)

A modern, opinionated starter template for building fast, accessible web applications.

## Tech Stack

- [Astro](https://astro.build/) v6 - Modern web framework with server-first rendering
- [React](https://react.dev/) v19 - UI library for interactive components
- [TypeScript](https://www.typescriptlang.org/) v5 - Type-safe JavaScript
- [Tailwind CSS](https://tailwindcss.com/) v4 - Utility-first CSS framework
- [Supabase](https://supabase.com/) - Authentication and backend-as-a-service
- [Cloudflare Workers](https://workers.cloudflare.com/) - Edge deployment runtime

## Prerequisites

- Node.js v22.14.0 (as specified in `.nvmrc`)
- npm (comes with Node.js)

## Getting Started

1. Clone the repository:

```bash
git clone https://github.com/przeprogramowani/10x-astro-starter.git
cd 10x-astro-starter
```

2. Install dependencies:

```bash
npm install
```

3. Set up Supabase and configure environment variables — see [Supabase Configuration](#supabase-configuration) below.

4. Create a `.dev.vars` file for local Cloudflare dev secrets:

```bash
cp .env.example .dev.vars
```

5. Run the development server:

```bash
npm run dev
```

## Available Scripts

- `npm run dev` - Start development server (Cloudflare workerd runtime)
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint with type-checked rules
- `npm run lint:fix` - Auto-fix ESLint issues
- `npm run format` - Run Prettier

## Project Structure

```md
.
├── src/
│ ├── layouts/ # Astro layouts
│ ├── pages/ # Astro pages
│ │ └── api/ # API endpoints
│ ├── components/ # UI components (Astro & React)
│ └── assets/ # Static assets
├── public/ # Public assets
├── wrangler.jsonc # Cloudflare Workers config
```

## Supabase Configuration

This project uses [Supabase](https://supabase.com/) for authentication. Environment variables are declared via Astro's `astro:env` schema and are treated as **server-only secrets** — they are never exposed to the client.

### First-time setup (local, no cloud project needed)

Requires [Docker](https://www.docker.com/) and ~7 GB RAM.

1. Create your `.env` file:

```bash
cp .env.example .env
```

2. Start the local stack from this repo root (downloads Docker images on first run):

```bash
npx supabase start
npx supabase db reset
```

3. Copy the credentials printed by the CLI into your `.env` and `.dev.vars`:

```
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_KEY=<anon key from CLI output>
```

4. To stop the stack when done:

```bash
npx supabase stop
```

The local Studio UI is available at `http://localhost:54323`.

Schema lives in `supabase/migrations/`. After `npx supabase start` (always from this repo root, so `project_id` in `supabase/config.toml` is used), apply it with:

```bash
npx supabase db reset
```

That recreates the local database and runs every migration. Repeat `db reset` whenever you add or change a migration file.

### First admin

Signups always get `profiles.role = 'user'`. Promote the first admin in **Studio SQL as the `postgres` role** (SQL Editor → role dropdown), not as the signed-in user:

```sql
SELECT id, email FROM auth.users;

UPDATE public.profiles
SET role = 'admin'
WHERE id = '<user-uuid-from-the-query-above>';
```

A `BEFORE UPDATE` trigger blocks role changes from the `authenticated` client. `postgres` (and `service_role`) can update `role` because they have `BYPASSRLS`. After promoting, sign out and back in so middleware reloads the profile.

### Using a cloud Supabase project instead

If you prefer to use a hosted Supabase project, add these variables to your `.env` and `.dev.vars` files:

| Variable       | Description                                                |
| -------------- | ---------------------------------------------------------- |
| `SUPABASE_URL` | Project URL from Supabase dashboard → Settings → API       |
| `SUPABASE_KEY` | `anon` public key from Supabase dashboard → Settings → API |

```
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_KEY=<anon-key>
```

### Email confirmation in local development

By default Supabase requires email confirmation before a user can sign in. To skip this during local development:

1. Open the Supabase dashboard for your project
2. Go to **Authentication → Email → Confirm email**
3. Toggle it **off**

Users can then sign in immediately after sign-up without clicking a confirmation link.

### Auth routes

| Route                 | Description                                                             |
| --------------------- | ----------------------------------------------------------------------- |
| `/auth/signin`        | Email/password sign-in form                                             |
| `/auth/signup`        | Email/password sign-up form                                             |
| `/auth/confirm-email` | Post-signup "check your inbox" page                                     |
| `/dashboard`          | Example protected page (redirects to `/auth/signin` if unauthenticated) |

Route protection is handled in `src/middleware.ts`. Add paths to the `PROTECTED_ROUTES` array there to require authentication. Successful sign-in redirects to `/catalog`.

### Catalog routes

| Route            | Who can access                          | Description                                                             |
| ---------------- | --------------------------------------- | ----------------------------------------------------------------------- |
| `/catalog`       | Signed-in users                         | Search and browse approved catalog items; assign to library or wishlist |
| `/library`       | Signed-in users                         | View and manage items assigned to your library; see tag-based recommendations when eligible |
| `/wishlist`      | Signed-in users                         | View and manage items on your wishlist                                  |
| `/admin/catalog` | Admins only (`profiles.role = 'admin'`) | Create, edit, approve, and reject catalog items                         |
| `/403`           | Anyone                                  | Forbidden page (also rewritten for non-admin `/admin` visits)           |

### Assignment API

| Route                          | Who can access  | Description                                                     |
| ------------------------------ | --------------- | --------------------------------------------------------------- |
| `GET /api/assignments`         | Signed-in users | List your assignments (optional `?list_type=library\|wishlist`) |
| `POST /api/assignments`        | Signed-in users | Assign item to library or wishlist (upsert on duplicate)        |
| `PATCH /api/assignments/[id]`  | Signed-in users | Move assignment to the other list                               |
| `DELETE /api/assignments/[id]` | Signed-in users | Remove assignment from your collection                          |

### Recommendations

| Route                      | Who can access  | Description                                                                 |
| -------------------------- | --------------- | --------------------------------------------------------------------------- |
| `GET /api/recommendations` | Signed-in users | Ranked catalog suggestions based on your library tags/descriptions (JSON) |

**Recommendations on `/library`:** Shown when you have **≥ 3 library items with at least one tag**. Ranks up to **10** approved catalog items you have not assigned (library or wishlist excluded). Seed data comes from your **library only** — not wishlist. Scoring uses tag overlap plus a light title/description substring boost from your library tags.

**List cap:** `/catalog`, `/library`, `/wishlist`, and `/admin/catalog` load all matching rows up to PostgREST `max_rows` (default **1000**). Beyond that, results are truncated silently — no pagination yet (follow-up: S-06). Recommendations rank within the approved catalog rows returned by `listApproved` (same cap).

Promote the first admin with the SQL in [First admin](#first-admin) above.

## Deployment

This project deploys to [Cloudflare Workers](https://workers.cloudflare.com/).

1. Build the project:

```bash
npm run build
```

2. Deploy with Wrangler:

```bash
npx wrangler deploy
```

Set `SUPABASE_URL` and `SUPABASE_KEY` as secrets in your Cloudflare dashboard or via `npx wrangler secret put`.

## CI

GitHub Actions runs lint + build on every push and PR to `master`. Configure `SUPABASE_URL` and `SUPABASE_KEY` as repository secrets in GitHub for the build step.

## License

MIT
