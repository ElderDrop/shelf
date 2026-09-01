# Repository Guidelines

**Shelf** is a web app for personal media collections (books, manga, comics): admin-curated catalog, per-user library and wishlist, tag-based suggestions, and read-only share links. Built on the 10x Astro starter (Astro 6 SSR, React 19 islands, TypeScript, Tailwind 4, Supabase, Cloudflare Workers). Stack and auth conventions: @CLAUDE.md. Product requirements: @context/foundation/prd.md.

## Agent-specific rules

- Never commit secrets (`.env`, `.dev.vars`, or live `SUPABASE_*` values). Start from @.env.example.
- New Supabase tables: add a migration in `supabase/migrations/` (`YYYYMMDDHHmmss_description.sql`) with RLS enabled; follow patterns in @CLAUDE.md.
- API routes under `src/pages/api/` must export `const prerender = false` (SSR app).
- Merge Tailwind classes with `cn()` from `@/lib/utils`; do not hand-concatenate class strings.
- Treat `context/foundation/` as canonical product/stack docs; put change-scoped plans under `context/changes/<change-id>/`, not in foundation.

## Project structure

- `src/pages/` — Astro pages; `src/pages/api/` — API endpoints.
- `src/components/` — UI; shadcn in `src/components/ui/`.
- `src/lib/` — Supabase client, shared helpers, services.
- `src/middleware.ts` — session user on `context.locals`; unauthenticated users blocked from `PROTECTED_ROUTES`.
- `context/foundation/` — `prd.md`, `shape-notes.md`, `tech-stack.md` (10x workflow).
- `context/changes/` — in-flight change folders (see @context/changes/README.md).

## Build, test, and development

- `npm run dev` — development server (Cloudflare workerd runtime).
- `npm run build` / `npm run preview` — production build and preview.
- `npm run lint` / `npm run lint:fix` — ESLint (@eslint.config.js).
- `npm run format` — Prettier (@.prettierrc.json).
- `npm test` / `npm run test:watch` — Vitest (Node); files under `src/**/*.{test,spec}.ts` (@vitest.config.ts). Prefer the cheapest layer that catches the risk — see @context/foundation/test-plan.md.
- `npx supabase start` — local Supabase (Docker); details in @README.md.
- Husky + lint-staged run on commit per @package.json.

## Coding style

- Node **v22.14.0** (@.nvmrc). Import via `@/*` → `src/*` (@tsconfig.json).
- Astro for layouts and static pages; React only for interactive islands (no Next.js `"use client"`).
- API handlers: uppercase `GET`/`POST`; validate request bodies with Zod.
- Add shadcn components with `npx shadcn@latest add <name>` into `src/components/ui/`.

## CI and pull requests

@.github/workflows/ci.yml on push/PR to `master`: `npm ci`, `npx astro sync`, `npm run lint`, `npm test`, `npm run build` (requires `SUPABASE_URL` and `SUPABASE_KEY` GitHub secrets for the build step). Commit-message convention is not established yet.

## Configuration

`SUPABASE_URL` and `SUPABASE_KEY` are server-only via Astro env schema (@astro.config.mjs). Cloudflare local secrets: `.dev.vars` (gitignored).
