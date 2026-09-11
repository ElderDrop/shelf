<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: UI Polish Implementation Plan

- **Plan**: context/changes/ui-polish/plan.md
- **Scope**: Phases 1–4 of 4 (all completed)
- **Date**: 2026-09-12
- **Verdict**: NEEDS ATTENTION → triage complete (all findings addressed)
- **Findings**: 0 critical, 4 warnings, 3 observations (all decisions recorded)

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | WARNING |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | WARNING |

## Findings

### F1 — Custom palette / tokens contradict plan “NOT Doing”

- **Severity**: ⚠️ WARNING
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Scope Discipline
- **Location**: src/styles/global.css:6–43,121–127; plan.md:22–27
- **Detail**: Plan locked zinc-by-hand and listed “Custom Shelf brand palette” and “migrating hard-coded zinc to semantic tokens” under What We’re NOT Doing. Implementation remapped CSS tokens to light brown/beige/white/black and introduced `shelf-page` / `shelf-panel`, with product/auth/home/dashboard on semantic classes. Intent was user-requested mid-flight and is recorded in `change.md` Notes, but the plan body/Overview/Desired End State still describe zinc and forbid this work — future reviews will treat the written plan as ground truth.
- **Fix A ⭐ Recommended**: Add a plan addendum (and refresh Overview / NOT Doing / Progress zinc wording) to record the accepted light-palette + semantic-token pivot
  - Strength: Matches what shipped and what’s already in change.md Notes; keeps plan as accurate source of truth.
  - Tradeoff: Plan becomes a slightly moving target after implementation.
  - Confidence: HIGH — Notes already document the pivot; only the plan prose is stale.
  - Blind spot: Stakeholders who approved the original zinc-only scope aren’t re-notified by a file edit alone.
- **Fix B**: Revert tokens/classes to hard-coded zinc and restore the original NOT Doing boundary
  - Strength: Strict scope discipline relative to the approved plan.
  - Tradeoff: Throws away intentional UX work the user asked for; large visual churn.
  - Confidence: HIGH that revert is possible; LOW that it’s desirable.
  - Blind spot: How much product copy/classes would need a second pass.
- **Decision**: Fixed via Fix A

### F2 — MediaItemRow dropped planned actions slot

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence
- **Location**: src/components/collection/MediaItemRow.astro:1–31
- **Detail**: Phase 2 planned a row component that owns list chrome and an actions slot. Implementation is meta-only (title/desc/tags/unavailable); parents own `<li>` chrome and place action islands as siblings. Documented in change.md (Astro drops hydration for nested `client:*`). Behavior and call sites match product intent; the component contract drifted from the written plan without a plan addendum.
- **Fix A ⭐ Recommended**: Add a plan addendum documenting the sibling-island contract and why the slot was abandoned
  - Strength: Preserves the working pattern; aligns plan with reality for future extracts.
  - Tradeoff: Documents a less elegant API than originally planned.
  - Confidence: HIGH — Notes already state the rule; plan just lags.
  - Blind spot: None significant.
- **Fix B**: Re-attempt a slot-based API with a non-island wrapper pattern (e.g. actions rendered outside the slotted island boundary)
  - Strength: Closer to the original component shape.
  - Tradeoff: High risk of reintroducing the hydration bug; non-trivial redesign.
  - Confidence: LOW — prior attempt failed under Astro + Cloudflare.
  - Blind spot: Whether a stable pattern exists without per-row `client:only`.
- **Decision**: Fixed via Fix A

### F3 — FormField lacks right padding under password toggle

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/auth/FormField.tsx:5–6,42–54
- **Detail**: Leading icon gets `pl-10`, but when `endContent` (PasswordToggle) is present the input has no matching `pr-*`. Long password values can render under the eye control.
- **Fix**: Apply `pr-10` (or equivalent) when `endContent` is set.
- **Decision**: FIXED

### F4 — Success criteria stamped while Progress still says zinc / full lint fails outside src

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Success Criteria
- **Location**: context/changes/ui-polish/plan.md:308–334; packages/code-review-agent/**
- **Detail**: Manual Progress items still claim “zinc product chrome” / “dark zinc background” / “useful zinc hub” (3.4, 3.6, 4.6) after the light-palette pivot — evidence in code is light semantic UI, so the checkbox text no longer matches what was verified. Automated Progress claims `npm run lint`; re-run today: `src/**` ESLint is clean (2 pre-existing `no-console` warnings), `npm test` 38/38 pass, `npm run build` succeeds; full `npm run lint` reports 24 errors in unrelated `packages/code-review-agent/` (pre-existing). Implement adapted the lint gate to `src` without updating Progress wording.
- **Fix A ⭐ Recommended**: Update Progress/manual wording to light palette + document the adapted lint command (`eslint src/**`) as the gate for this change
  - Strength: Makes the completion record honest without blocking on unrelated package debt.
  - Tradeoff: Softens the literal Progress command string.
  - Confidence: HIGH — matches how phases were actually gated.
  - Blind spot: Whether CI still runs full-repo lint and fails independently.
- **Fix B**: Fix or exclude `packages/code-review-agent` so full `npm run lint` is green, and rewrite Progress zinc lines to light palette
  - Strength: Restores the plan’s literal automated criteria.
  - Tradeoff: Pulls unrelated package cleanup into ui-polish follow-up.
  - Confidence: MEDIUM — prettier/type errors look mechanical but out of slice.
  - Blind spot: Whether that package is intentionally WIP / excluded from CI.
- **Decision**: Fixed via Fix A

### F5 — Per-row `client:only` islands multiply React mounts

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/pages/catalog.astro:76–83; library.astro; wishlist.astro
- **Detail**: Each list row mounts its own `client:only="react"` actions island (required after Badge Slot / hydration fixes). Actions are blank until JS; large catalogs multiply islands. Acceptable for current PostgREST-capped lists; worth revisiting if pagination lands.
- **Fix**: Defer to a follow-up that collapses assignment actions into one list-level island once a hydration-safe pattern is proven.
- **Decision**: FIXED (queued in follow-ups/review-fixes.md)

### F6 — Auth pages echo arbitrary `?error=` query text

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/auth/signin.astro:5; signup.astro:5; ServerError.tsx:13
- **Detail**: Pre-existing pattern (blame predates ui-polish); React escapes so this is not HTML XSS, but a crafted URL can spoof a trusted-looking server message. Phase 3 only restyled these pages.
- **Fix**: Allowlist known error codes/messages server-side; map to fixed copy (out of ui-polish scope unless triage opts in).
- **Decision**: FIXED

### F7 — Minor leftovers after shared helpers / palette migration

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/admin/CatalogList.tsx:~111; src/styles/global.css:117–119
- **Detail**: Admin empty search copy is still a raw `<p>` instead of `EmptyState`; unused `bg-cosmic` utility remains after dropping cosmic auth chrome.
- **Fix**: Swap CatalogList empty to `EmptyState` and delete unused `bg-cosmic` if unused.
- **Decision**: FIXED (EmptyCopy React twin + removed bg-cosmic)

## Triage summary

- **Fixed**: F1 (Fix A), F2 (Fix A), F3, F4 (Fix A), F5 (follow-up), F6, F7
- **Skipped / Accepted / Rules**: none
