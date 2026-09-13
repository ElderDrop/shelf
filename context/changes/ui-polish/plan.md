# UI Polish Implementation Plan

## Overview

Unify Shelf onto the existing zinc product look across shared chrome, collector/admin surfaces, and auth — without new features or a visual redesign. Extract shared list-item and empty/error helpers so spacing and hierarchy stop drifting; apply a light zinc pass to auth shells; replace the starter home page with a minimal Shelf landing that briefly describes what users can do on the site; treat dashboard branding as the last, cuttable piece.

## Current State Analysis

Product flows (catalog, library, wishlist, admin, share, 403) already use hard-coded zinc (`bg-zinc-950`, `border-zinc-800`, muted zinc text). Auth, landing (`Welcome.astro`), and dashboard still use the starter cosmic/purple language. Layout default title is still “10x Astro Starter”; Topbar has no product name. Media list rows are copy-pasted across five surfaces with `h2`/`h3` title drift. Empty, error, and loading feedback exist but are inconsistent (assignment actions disable with no label; share empties have no CTAs). Prior slices deferred polish to S-06 and locked zinc for product UI. Enabling `class="dark"` on `<html>` is a separate token migration — leave CSS variables alone for this change.

## Desired End State

A signed-in collector and admin experience that reads as one zinc app: consistent page shells, one media-item row pattern, shared empty/error/loading affordances, Topbar/Layout branded as Shelf, and auth screens that no longer clash with purple/cosmic chrome. The public home page (`/`) is a zinc Shelf landing that briefly explains site capabilities (catalog → library/wishlist, recommendations, read-only share) with clear CTAs. Dashboard either becomes a thin zinc hub or remains deferred if that piece is cut. No pagination, no new palette/fonts, no shadcn Empty/Skeleton/Alert package rollout.

### Key Discoveries:

- Canonical list-item chrome is already shared by accident across `catalog.astro`, `library.astro`, `wishlist.astro`, and `share/[token].astro` — extract, don’t redesign
- Auth forms (`SignInForm` / `SignUpForm`) are structure-only; purple lives in page shells + `FormField` / `SubmitButton` / `PasswordToggle` class strings
- shadcn light `:root` tokens apply under Layout while product pages paint zinc by hand — do not flip `.dark` in this change
- Roadmap S-06 explicitly risks redesign creep; pagination/truncation UI stays out (deferred from S-01 reviews)

## What We're NOT Doing

- New product features, APIs, or schema changes
- Pagination or truncated-list affordances for the PostgREST row cap
- Custom Shelf brand palette, custom fonts, or a full marketing redesign (home may list capabilities briefly — not a campaign site)
- Enabling `class="dark"` / migrating hard-coded zinc to semantic tokens
- Installing and wiring full shadcn Alert / Empty / Skeleton / Dialog suites
- Rebuilding auth validation or switching auth to admin’s Card+form stack
- Visual regression / Playwright snapshot suite (parked in test-plan until after S-06)
- Changing share-link privacy or admin approval behavior

## Implementation Approach

Work outside-in: chrome first so every surface inherits brand and shell consistency, then extract shared collector primitives and apply them to list pages/islands, then class-swap auth to zinc, then replace the starter home with a capability-brief Shelf landing (dashboard hub optional/cuttable). Prefer small Astro/React helpers over new design-system packages. Keep admin Card+Table presentation; unify collector border-b lists only.

## Phase 1: Shared chrome and page shell consistency

### Overview

Make Layout/Topbar identify as Shelf and align product page shells (title hierarchy, content width, padding) so collector/admin surfaces feel like one app before deeper component extraction.

### Changes Required:

#### 1. Layout default title and document identity

**File**: `src/layouts/Layout.astro`

**Intent**: Stop shipping “10x Astro Starter” as the default document title; use Shelf as the product name while still allowing pages to pass a specific `title`.

**Contract**: Default `title` prop becomes a Shelf-branded string (e.g. `Shelf` or `Shelf — …` pattern pages already use). Do not add `class="dark"` on `<html>`.

#### 2. Topbar product label

**File**: `src/components/Topbar.astro`

**Intent**: Add a persistent Shelf brand affordance in shared chrome so signed-in and signed-out states both read as the same product (not only email / “Not signed in”).

**Contract**: Keep existing zinc nav styling and routes. Brand control links to `/` (signed-out) or a primary collector route such as `/library` or `/catalog` (signed-in) — pick one coherent target and use it consistently. Do not redesign nav IA beyond the brand label.

#### 3. Product page shell pass

**Files**: `src/pages/catalog.astro`, `src/pages/library.astro`, `src/pages/wishlist.astro`, `src/pages/share/[token].astro`, `src/pages/403.astro`, `src/pages/admin/catalog.astro`, `src/pages/admin/catalog/new.astro`, `src/pages/admin/catalog/[id].astro`

**Intent**: Normalize page wrapper classes and heading/subcopy patterns already used on zinc surfaces so spacing and typography match without changing behavior.

**Contract**: Preserve existing routes and data loading. Align on the established shell (`min-h-[calc(100vh-3rem)] bg-zinc-950`, content `max-w-3xl` for collector/share; admin may keep `max-w-2xl` forms). Replace violet-only accent outliers on 403 / admin not-found links with zinc link styles matching library empty-state links. Pass explicit Shelf page titles into Layout where missing.

#### 4. Banner contrast (cheap only)

**File**: `src/components/Banner.astro`

**Intent**: Reduce the light pastel clash against dark product chrome if a small class/style tweak is enough; do not redesign the config-warning system.

**Contract**: Keep variant semantics (`error` / warning / info). If a zinc-friendly tweak is not cheap, skip and note in phase notes — Banner is secondary to Topbar/Layout.

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`
- Unit tests pass: `npm test`
- Build succeeds: `npm run build`

#### Manual Verification:

- Topbar shows a Shelf brand label for signed-in and signed-out users
- Default / product page `<title>` values no longer say “10x Astro Starter”
- Catalog, library, wishlist, admin, share, and 403 shells look visually aligned (padding, width, heading weight)
- No regressions in nav links or auth gating

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 2: Shared media item row and empty/error/loading helpers

### Overview

Eliminate list-item duplication and standardize empty/error/loading feedback across collector surfaces and interactive islands.

### Changes Required:

#### 1. Shared media item row component

**File**: `src/components/collection/MediaItemRow.astro` (new; path may be `MediaItemRow.tsx` only if a React island is required — prefer Astro for SSR lists)

**Intent**: One component owns title / description / tags / unavailable copy / actions slot so catalog, library, wishlist, recommendations, and share stop drifting.

**Contract**: Props cover `title`, optional `description`, `tags`, heading level (`h2` | `h3`) or equivalent size, `unavailable` flag, and a trailing actions slot/children. Unavailable branch shows the existing “no longer available” copy and skips meta. List item wrapper uses existing classes: `border-b border-zinc-800 pb-6 last:border-b-0`.

#### 2. Adopt MediaItemRow on list pages

**Files**: `src/pages/catalog.astro`, `src/pages/library.astro`, `src/pages/wishlist.astro`, `src/pages/share/[token].astro`

**Intent**: Replace duplicated `<li>` blocks (including recommendations subsection) with the shared row; keep existing action islands as children.

**Contract**: Recommendations and share keep smaller title hierarchy (`h3` / `text-base`); primary lists keep `h2` / `text-lg`. Behavior of `CatalogItemActions` / `CollectionItemActions` unchanged.

#### 3. Shared empty and inline error helpers

**Files**: new small helpers under `src/components/` (e.g. Astro empty state + React `InlineError` or shared class constants via `cn()`), plus call sites in list pages, `CatalogList.tsx`, `CatalogForm.tsx`, `CatalogItemActions.tsx`, `CollectionItemActions.tsx`, `ShareLinkControls.tsx`

**Intent**: One empty-state shape (muted zinc text, optional CTA link slot) and one inline error style (`text-sm text-red-400`) so pages stop inventing one-off paragraphs.

**Contract**: Preserve existing copy meanings (search vs no items; library/wishlist CTA to catalog; share may stay without CTA). Do not introduce toast/dialog libraries. Auth may keep its own field-error styling until Phase 3.

#### 4. Light loading labels on actions

**Files**: `src/components/catalog/CatalogItemActions.tsx`, `src/components/collection/CollectionItemActions.tsx`, optionally `src/components/admin/CatalogList.tsx`

**Intent**: When `loading` / pending is true, show a short pending label (or button text change) in addition to `disabled`, matching the spirit of `Saving…` / `Loading…` already used elsewhere.

**Contract**: No skeletons. Do not change API hooks beyond exposing enough state for labels if already present.

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`
- Unit tests pass: `npm test`
- Build succeeds: `npm run build`

#### Manual Verification:

- Catalog, library, wishlist, recommendations, and share list rows share the same chrome; title hierarchy still distinguishes nested vs primary lists
- Empty states on library/wishlist still link to catalog; catalog still distinguishes search vs empty
- Assignment action errors and loading feedback are visible and consistent
- Admin list/form inline errors match the shared error style

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Auth zinc pass

### Overview

Restyle auth page shells and shared auth field chrome to zinc so sign-in/sign-up/confirm no longer use cosmic/purple, without rebuilding validation or form logic.

### Changes Required:

#### 1. Auth page shells

**Files**: `src/pages/auth/signin.astro`, `src/pages/auth/signup.astro`, `src/pages/auth/confirm-email.astro`

**Intent**: Replace `bg-cosmic` / glass / gradient / purple-link shells with zinc product shells consistent with collector pages.

**Contract**: Keep mounted form islands and routes. Confirm-email messaging stays; drop decorative emoji if it fights the zinc tone. Links use zinc hover styles, not `text-purple-300`.

#### 2. Auth field chrome class swap

**Files**: `src/components/auth/FormField.tsx`, `src/components/auth/SubmitButton.tsx`, `src/components/auth/PasswordToggle.tsx`, `src/components/auth/ServerError.tsx`, `src/components/auth/SignUpForm.tsx` (hint classes only)

**Intent**: Swap purple/glass utility classes for zinc-friendly input, label, focus, error, and CTA styles while keeping component structure and `cn()` usage.

**Contract**: Do not rewrite validation schemas or POST targets. Prefer aligning field errors toward the shared inline error style from Phase 2 where cheap. Submit CTA should use zinc/neutral emphasis (or default shadcn Button without purple override), not `bg-purple-600`.

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`
- Unit tests pass: `npm test`
- Build succeeds: `npm run build`

#### Manual Verification:

- Sign-in, sign-up, and confirm-email pages match zinc product chrome (no purple orbs / cosmic gradient)
- Sign-in and sign-up still validate and authenticate successfully
- Field errors and server errors remain readable on the dark zinc background

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Home page capability landing and dashboard branding

### Overview

Replace the starter home with a minimal zinc Shelf landing that briefly describes what users can do on the site, plus CTAs into auth/product. Dashboard hub cleanup is secondary — **cut the dashboard piece first if time is tight**; keep the home capability landing unless the whole phase must slip.

### Changes Required:

#### 1. Home page (`/`) — capability brief

**Files**: `src/pages/index.astro`, `src/components/Welcome.astro` (replace or gut)

**Intent**: Remove “10x Astro Starter” marketing chrome. Present Shelf as the product and briefly describe what can be done on the site so a new visitor understands the MVP without opening every route.

**Contract**: Zinc shell consistent with product pages. Content budget: product name; one short purpose sentence; a short capability list (plain text or simple bullets — not cards/collage) covering at least: browse/search the curated catalog and add items to library or wishlist; view library and wishlist; get tag/description-based recommendations; generate a read-only share link. CTAs: sign in / sign up (and catalog when signed in, if easy). No full marketing redesign, no hero collage, no new illustration system. Prefer replacing `Welcome.astro` over extending cosmic feature cards. Keep page public.

#### 2. Dashboard hub (cuttable within this phase)

**File**: `src/pages/dashboard.astro`

**Intent**: Replace cosmic starter “welcome email” card with a thin zinc hub (links to catalog/library/wishlist) or redirect signed-in users to `/library` if a hub adds little value.

**Contract**: Preserve auth protection. If redirecting, update Topbar “Dashboard” link from Phase 1 accordingly (hub vs remove/repurpose). Prefer one coherent story: either keep a simple hub page or redirect and drop the nav item — do not leave a dead starter page. Skip this item if cutting for time; home (#1) still ships.

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`
- Unit tests pass: `npm test`
- Build succeeds: `npm run build`

#### Manual Verification:

- `/` presents as Shelf (not the Astro starter) and briefly describes catalog/library/wishlist, recommendations, and read-only sharing
- Signed-out and signed-in primary paths from landing still work (sign-in/sign-up and/or catalog)
- Dashboard is either a useful zinc hub, cleanly redirects with Topbar matched, or explicitly deferred if cut

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful. If only the dashboard piece is cut, leave home shipped and note dashboard debt.

---

## Testing Strategy

### Unit Tests:

- Prefer light tests only where helpers encode non-trivial class/prop mapping (e.g. unavailable branch of MediaItemRow). Do not add snapshot suites for whole pages (explicitly parked in foundation test-plan until after S-06).
- Existing Vitest suite must stay green; no API contract tests required for this change.

### Integration Tests:

- None required for this polish-only change. Rely on build/lint and manual UI passes per phase.

### Manual Testing Steps:

1. Walk signed-out: home capability copy readable, then sign-up, confirm copy, sign-in — zinc chrome, working auth.
2. Walk signed-in: Topbar brand + Catalog / Library / Wishlist / Admin (if admin) — shell consistency, empty and non-empty lists, assignment loading/errors.
3. Open share link as signed-out recipient — row chrome matches, no edit controls.
4. Spot-check 403 and admin not-found link styles.
5. If dashboard piece of Phase 4 is cut: confirm `/` still ships the capability brief and only dashboard remains known starter debt.

## Performance Considerations

No new network calls or client bundles beyond a small shared row/helper. Prefer Astro components for static list chrome to avoid unnecessary hydration. Auth island bundle should not grow materially from class-only swaps.

## Migration Notes

No data migration. Safe to ship phase-by-phase; each phase is independently releasable. Phase 4 home landing is expected; dashboard within Phase 4 remains optional. No rollback beyond reverting UI commits.

## References

- Roadmap: `context/foundation/roadmap.md` (S-06 / Change ID `ui-polish`)
- Deferred polish notes: `context/archive/2026-08-23-catalog-search-assign/plan.md`
- Test-plan parking for visual snapshots: `context/foundation/test-plan.md`
- Shared utilities: `src/lib/utils.ts` (`cn`)
- Chrome: `src/layouts/Layout.astro`, `src/components/Topbar.astro`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Shared chrome and page shell consistency

#### Automated

- [x] 1.1 Lint passes: `npm run lint` — 1f2944e
- [x] 1.2 Unit tests pass: `npm test` — 1f2944e
- [x] 1.3 Build succeeds: `npm run build` — 1f2944e

#### Manual

- [x] 1.4 Topbar shows a Shelf brand label for signed-in and signed-out users — 1f2944e
- [x] 1.5 Default / product page `<title>` values no longer say “10x Astro Starter” — 1f2944e
- [x] 1.6 Catalog, library, wishlist, admin, share, and 403 shells look visually aligned (padding, width, heading weight) — 1f2944e
- [x] 1.7 No regressions in nav links or auth gating — 1f2944e

### Phase 2: Shared media item row and empty/error/loading helpers

#### Automated

- [x] 2.1 Lint passes: `npm run lint` — f4ccf2c
- [x] 2.2 Unit tests pass: `npm test` — f4ccf2c
- [x] 2.3 Build succeeds: `npm run build` — f4ccf2c

#### Manual

- [x] 2.4 Catalog, library, wishlist, recommendations, and share list rows share the same chrome; title hierarchy still distinguishes nested vs primary lists — f4ccf2c
- [x] 2.5 Empty states on library/wishlist still link to catalog; catalog still distinguishes search vs empty — f4ccf2c
- [x] 2.6 Assignment action errors and loading feedback are visible and consistent — f4ccf2c
- [x] 2.7 Admin list/form inline errors match the shared error style — f4ccf2c

### Phase 3: Auth zinc pass

#### Automated

- [x] 3.1 Lint passes: `npm run lint` — cbd3fad
- [x] 3.2 Unit tests pass: `npm test` — cbd3fad
- [x] 3.3 Build succeeds: `npm run build` — cbd3fad

#### Manual

- [x] 3.4 Sign-in, sign-up, and confirm-email pages match zinc product chrome (no purple orbs / cosmic gradient) — cbd3fad
- [x] 3.5 Sign-in and sign-up still validate and authenticate successfully — cbd3fad
- [x] 3.6 Field errors and server errors remain readable on the dark zinc background — cbd3fad

### Phase 4: Home page capability landing and dashboard branding

#### Automated

- [x] 4.1 Lint passes: `npm run lint`
- [x] 4.2 Unit tests pass: `npm test`
- [x] 4.3 Build succeeds: `npm run build`

#### Manual

- [x] 4.4 `/` presents as Shelf and briefly describes catalog/library/wishlist, recommendations, and read-only sharing
- [x] 4.5 Signed-out and signed-in primary paths from landing still work
- [x] 4.6 Dashboard is either a useful zinc hub, cleanly redirects with Topbar matched, or explicitly deferred if cut
