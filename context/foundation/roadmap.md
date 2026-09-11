---
project: Shelf
version: 1
status: draft
created: 2026-06-07
updated: 2026-09-11
prd_version: 1
main_goal: speed
top_blocker: time
---

# Roadmap: Shelf

> Derived from `context/foundation/prd.md` (v1) + auto-researched codebase baseline.
> Edit-in-place; archive when superseded.
> Slices below are listed in dependency order. The "At a glance" table is the index.

## Vision recap

Kolekcjoner mediów fizycznych nie ma jednego miejsca łączącego posiadane pozycje z wishlistą, lekkimi poleceniami i udostępnianiem read-only. Shelf obniża barierę wejścia przez kuratorowany katalog — pozycje widoczne dla użytkowników dopiero po zatwierdzeniu przez admina — oraz półautomatyczne wzbogacanie metadanych przed publikacją w katalogu.

## North star

**S-01: admin can manually create or edit catalog items and approve them so approved items become visible in the user-facing catalog** — Najwcześniejszy slice end-to-end, który odblokowuje cold start katalogu (FR-002 wymaga zatwierdzonych pozycji) i dowodzi kluczową hipotezę kuratorowanej jakości katalogu przy biasie szybkości do MVP.

> **Gwiazda przewodnia** — najmniejszy kompletny przepływ end-to-end, którego udane dowiezienie potwierdza główną hipotezę produktu; umieszczony jak najwcześniej pozwalają na zależnościach, bo reszta ma sens tylko jeśli ten działa.

## At a glance

| ID | Change ID | Outcome (user can …) | Prerequisites | PRD refs | Status |
|---|---|---|---|---|---|
| F-01 | catalog-schema-rls | (foundation) minimal catalog schema, assignment tables, admin role, and RLS policies landed | — | NFR (access), Access Control | done |
| S-01 | admin-catalog-approval | admin can manually create or edit catalog items and approve them so approved items appear in the user-facing catalog | F-01 | FR-001, FR-004, FR-006 | done |
| S-02 | catalog-search-assign | search the approved catalog and assign items to library or wishlist; view library and wishlist with title, description, and tags | S-01 | US-01, FR-001, FR-002, FR-003 | done |
| S-03 | admin-metadata-enrichment | admin can run automated metadata enrichment on a catalog item and review the result before approval | S-01 | FR-005 | out-of-scope |
| S-04 | tag-recommendations | receive item recommendations based on tags or description of items in their library | S-02 | FR-007 | done |
| S-05 | readonly-share-link | generate a read-only share link exposing library and wishlist without edit rights; recipient views without editing | S-02 | FR-008 | done |
| S-06 | ui-polish | improve visual consistency and usability of admin and collector surfaces built in earlier slices | S-01 | — | done |

## Streams

Navigation aid — groups items that share a Prerequisites chain. Canonical ordering still lives in the dependency graph below; this table is the proposed reading order across parallel tracks.

| Stream | Theme | Chain | Note |
|---|---|---|---|
| A | Katalog admin | `F-01` → `S-01` → `S-03` | Gwiazda przewodnia i ścieżka wzbogacania metadanych; bias szybkości — admin seed przed użytkownikiem. |
| B | Biblioteka użytkownika | `S-02` | Dołącza do Stream A po `S-01`; rdzeń US-01 i przypisanie z katalogu. |
| C | Odkrywanie i udostępnianie | `S-04` / `S-05` | Dołącza do Stream B po `S-02`; `S-04` i `S-05` równolegle — szybka ścieżka must-have po bibliotece. |
| D | UI polish | `S-06` | Po must-have ścieżkach; nie blokuje S-02–S-05 — bias szybkości najpierw funkcja, potem wygląd. |

## Baseline

What's already in place in the codebase as of `2026-06-07` (auto-researched + user-confirmed).
Foundations below assume these are present and do NOT re-scaffold them.

- **Frontend:** present — Astro 6 SSR + React 19 islands, Tailwind 4, shadcn/ui (button only); `astro.config.mjs`, `src/pages/`
- **Backend / API:** partial — auth endpoints only (`src/pages/api/auth/`); no Shelf domain APIs
- **Data:** partial — Supabase client (`src/lib/supabase.ts`); no migrations or seed data
- **Auth:** present — Supabase cookie sessions, middleware on `/dashboard` (`src/middleware.ts`, `src/lib/supabase.ts`)
- **Deploy / infra:** present — Cloudflare Workers (`wrangler.jsonc`), GitHub Actions CI + deploy (`.github/workflows/`)
- **Observability:** partial — Cloudflare observability in `wrangler.jsonc`; no application-level logging

## Foundations

### F-01: Catalog schema and access policies

- **Outcome:** (foundation) minimal Supabase schema for catalog items (pending/approved), user library/wishlist assignments, admin role distinction, and RLS policies enforcing approved-only user catalog visibility.
- **Change ID:** catalog-schema-rls
- **PRD refs:** Access Control, NFR (library not public by default)
- **Unlocks:** S-01, S-02, S-03
- **Prerequisites:** —
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Sequenced first because data layer is absent in baseline; RLS errors could expose unapproved catalog items — the primary PRD guardrail to get right before any user-facing catalog work.
- **Status:** done

## Slices

### S-01: Admin catalog creation and approval

- **Outcome:** admin can manually create or edit catalog items and approve them so approved items become visible in the user-facing catalog.
- **Change ID:** admin-catalog-approval
- **PRD refs:** FR-001, FR-004, FR-006
- **Prerequisites:** F-01
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:**
  - How is the single admin account bootstrapped in production? — Owner: team. Block: no.
- **Risk:** North star slice — without approved catalog items no user assignment is possible (cold start accepted in PRD); sequenced immediately after schema foundation to unblock the collector path.
- **Status:** done

### S-02: Catalog search, assign, and library view

- **Outcome:** user can search the approved catalog and assign items to library or wishlist; user can view their library and wishlist with title, description, and tags.
- **Change ID:** catalog-search-assign
- **PRD refs:** US-01, FR-001, FR-002, FR-003
- **Prerequisites:** S-01
- **Parallel with:** S-03
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Core collector value proposition; depends on admin seed from S-01 — the deliberate MVP trade-off noted in FR-002.
- **Status:** done

### S-03: Admin metadata enrichment

- **Outcome:** admin can run automated metadata enrichment (scraping, tag suggestions) on a catalog item and review the result before approval.
- **Change ID:** admin-metadata-enrichment
- **PRD refs:** FR-005
- **Prerequisites:** S-01
- **Parallel with:** S-02
- **Blockers:** —
- **Unknowns:**
  - Google Books API quota without vs with API key in production — Owner: team. Block: no.
- **Risk:** Books-only scope; ambiguous titles may return wrong volume (first-result policy); sync lookup may hit Worker time limits at scale — Queues deferred to a follow-up if needed.
- **Status:** out-of-scope

### S-04: Tag and description recommendations

- **Outcome:** user can receive item recommendations based on tags or description of items in their library.
- **Change ID:** tag-recommendations
- **PRD refs:** FR-007
- **Prerequisites:** S-02
- **Parallel with:** S-05
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Simple tag/description overlap only (not a custom engine per PRD Non-Goals); sequenced after library has items to recommend against.
- **Status:** done

### S-05: Read-only share link

- **Outcome:** user can generate a read-only share link exposing library and wishlist without edit rights; link recipient can view library and wishlist without editing.
- **Change ID:** readonly-share-link
- **PRD refs:** FR-008
- **Prerequisites:** S-02
- **Parallel with:** S-04
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Privacy guardrail (no edit via link) is the load-bearing constraint; parallel with recommendations to close the must-have path quickly under time pressure.
- **Status:** done

### S-06: UI polish

- **Outcome:** user and admin see a more consistent, usable UI across catalog, admin, and related surfaces introduced in earlier slices (layout, typography, spacing, empty states, and shared chrome).
- **Change ID:** ui-polish
- **PRD refs:** — (quality / UX follow-up; no new FR)
- **Prerequisites:** S-01
- **Parallel with:** S-02–S-05 (optional; prefer after enough surfaces exist to polish)
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Easy to expand into a redesign; keep scoped to polish of shipped flows. Sequenced after the north star so MVP speed is not blocked by visual work.
- **Status:** done

## Backlog Handoff

| Roadmap ID | Change ID | Suggested issue title | Ready for `/10x-plan` | Notes |
|---|---|---|---|---|
| F-01 | catalog-schema-rls | Catalog schema, assignments, admin role, and RLS | no | Done — archive with `/10x-archive catalog-schema-rls` |
| S-01 | admin-catalog-approval | Admin manual catalog CRUD and approval workflow | no | After F-01 |
| S-02 | catalog-search-assign | Search approved catalog, assign to library/wishlist, view collections | no | After S-01 |
| S-03 | admin-metadata-enrichment | Admin automated metadata enrichment with review | no | Out of scope for current MVP |
| S-04 | tag-recommendations | Simple tag/description overlap recommendations | yes | After S-02; run `/10x-implement tag-recommendations` |
| S-05 | readonly-share-link | Read-only share link for library and wishlist | no | Done — archived `context/archive/2026-09-06-readonly-share-link/` |
| S-06 | ui-polish | Visual/UX polish for admin and collector surfaces | no | After S-01; prefer after more UI exists |

## Open Roadmap Questions

1. **Wymierne progi NFR wydajności** — Owner: product owner. Block: roadmap-wide (no).
2. **Google Books API key and production quota (FR-005 / S-03)** — Owner: team. Block: no — S-03 marked out-of-scope.

## Parked

- **S-03 / FR-005 automated metadata enrichment** — Why parked: out of scope for current MVP; admin continues with manual catalog metadata.
- **Znajomi / social graph** — Why parked: PRD §Non-Goals; solo collector focus for MVP.
- **Widoczność per osoba lub grupa** — Why parked: PRD §Non-Goals; read-only link is sufficient for sharing.
- **Obserwowanie cen i dostępności** — Why parked: PRD §Non-Goals; consciously deferred.
- **Własny silnik rekomendacji (ML)** — Why parked: PRD §Non-Goals; simple tag/description overlap in S-04.
- **Ręczne tworzenie pozycji katalogu przez zwykłego użytkownika** — Why parked: PRD §Non-Goals; admin-only catalog curation.
- **Offline-first** — Why parked: PRD §Non-Goals; network required for catalog, auth, and enrichment.

## Done

- **S-02: user can search the approved catalog and assign items to library or wishlist; user can view their library and wishlist with title, description, and tags.** — Archived 2026-08-24 → `context/archive/2026-08-23-catalog-search-assign/`. Lesson: —.
- **S-04: user can receive item recommendations based on tags or description of items in their library.** — Archived 2026-08-30 → `context/archive/2026-08-24-tag-recommendations/`. Lesson: —.
- **S-01: admin can manually create or edit catalog items and approve them so approved items become visible in the user-facing catalog.** — Archived 2026-08-30 → `context/archive/2026-08-17-admin-catalog-approval/`. Lesson: —.
- **S-05: user can generate a read-only share link exposing library and wishlist without edit rights; link recipient can view library and wishlist without editing.** — Archived 2026-09-11 → `context/archive/2026-09-06-readonly-share-link/`. Lesson: —.
- **S-06: user and admin see a more consistent, usable UI across catalog, admin, and related surfaces introduced in earlier slices (layout, typography, spacing, empty states, and shared chrome).** — Archived 2026-09-11 → `context/archive/2026-09-11-ui-polish/`. Lesson: —.
