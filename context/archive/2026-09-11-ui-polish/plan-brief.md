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
| Visual system | Light brown / beige / white / black | User-chosen light mode; semantic tokens replace zinc |
| Landing/dashboard | Capability brief + CTAs (expected) | Visitors understand what Shelf does without a marketing redesign |
| Dashboard | Secondary / cuttable within Phase 4 | Lower traffic than home; cut first if time is tight |
| Auth | Class-level pass onto light Shelf tokens (Phase 3) | Ends cosmic clash with low risk |
| Empty/error/loading | Shared helpers + light pending labels | Usability without Skeleton/Alert package sprawl |
| List chrome | Extract shared media item row | Stops h2/h3 and markup drift |
| Pagination | Out of scope | Avoids feature creep called out in roadmap |

## Scope

**In scope:** Layout/Topbar Shelf branding; light brown/beige/white/black product tokens; shared media row; empty/error/loading helpers; auth restyle onto same tokens; home capability landing; optional dashboard hub.

**Out of scope:** Pagination/truncation UI; custom fonts; campaign-style marketing redesign; full shadcn Empty/Skeleton/Alert rollout; new features/APIs; visual snapshot suite.

## Architecture / Approach

Semantic tokens in `global.css` drive product UI (`background` parchment, `card` white, `foreground` near-black, `primary` walnut). Pages use `shelf-page` / `shelf-panel`; React islands stay page-level siblings of `MediaItemRow` (no slot nesting). Auth/home still cosmic until Phases 3–4.

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
