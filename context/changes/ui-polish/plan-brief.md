# UI Polish — Plan Brief

> Full plan: `context/changes/ui-polish/plan.md`

## What & Why

Ship a visual/UX consistency pass across Shelf’s admin and collector surfaces so the app reads as one product instead of zinc product pages plus leftover cosmic starter chrome. No new FRs — quality follow-up for roadmap S-06 after must-have slices landed. Includes replacing the starter home with a short capability overview of what users can do on the site.

## Starting Point

Catalog, library, wishlist, admin, and share already use hard-coded zinc list/shell patterns, but auth/landing/dashboard remain purple/cosmic, Layout still defaults to “10x Astro Starter,” and list/empty/error markup is duplicated with hierarchy drift. Home (`Welcome.astro`) is still the Astro starter marketing page.

## Desired End State

Collectors and admins see consistent zinc chrome, shared media rows, and coherent empty/error/loading feedback; auth matches zinc; `/` is a Shelf landing that briefly describes catalog/library/wishlist, recommendations, and read-only sharing; dashboard is a thin hub or deferred.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| Surface scope | Product + chrome + starter leftovers; auth light pass | Fixes dual-theme jank without a full redesign |
| Visual system | Zinc as product system | Matches prior slices; avoids new brand palette |
| Home page | Capability brief + CTAs (expected) | Visitors understand what Shelf does without a marketing redesign |
| Dashboard | Secondary / cuttable within Phase 4 | Lower traffic than home; cut first if time is tight |
| Auth | Class-level zinc pass, not rebuild | Ends purple clash with low risk |
| Empty/error/loading | Shared helpers + light pending labels | Usability without Skeleton/Alert package sprawl |
| List chrome | Extract shared media item row | Stops h2/h3 and markup drift |
| Pagination | Out of scope | Avoids feature creep called out in roadmap |

## Scope

**In scope:** Layout/Topbar Shelf branding; product page shell alignment; shared media row; empty/error/loading helpers; auth zinc restyle; home capability landing; optional dashboard hub.

**Out of scope:** Pagination/truncation UI; custom fonts/palette; `.dark` token migration; full shadcn Empty/Skeleton/Alert rollout; campaign-style marketing redesign; new features/APIs; visual snapshot suite.

## Architecture / Approach

Harden zinc in place. Prefer Astro for SSR list chrome; keep existing React action islands as slots. Class-swap auth shells/fields. Leave `global.css` semantic tokens alone — product UI already paints zinc utilities. Home is short prose/bullets of MVP capabilities, not a feature-card marketing system.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Shared chrome & shells | Shelf titles/Topbar + aligned page shells | Over-touching Banner / nav IA |
| 2. Media row + helpers | One list pattern; consistent empty/error/loading | Over-abstracting props |
| 3. Auth zinc pass | Sign-in/up/confirm match product chrome | Breaking focus/error readability |
| 4. Home capability + dashboard | `/` explains what Shelf does; dashboard optional | Scope creep into marketing redesign |

**Prerequisites:** S-01+ product surfaces already shipped (satisfied).
**Estimated effort:** ~2–3 sessions across Phases 1–4; dashboard within Phase 4 optional.

## Open Risks & Assumptions

- Easy to expand into a redesign — home stays a brief capability list, not a campaign page.
- Dashboard may be skipped; home capability landing is still expected.
- Hard-coded zinc + unused light tokens remain a future theme-migration debt.

## Success Criteria (Summary)

- Product + auth surfaces read as one zinc Shelf app (no cosmic/purple clash on the daily path).
- List/empty/error/loading patterns are consistent across collector surfaces.
- `/` presents as Shelf and briefly describes what users can do; “10x Astro Starter” is gone from chrome/titles.
