# Review follow-ups — ui-polish

Queued from `reviews/impl-review.md` triage (2026-09-12).

## F5 — Collapse per-row assignment islands

**Problem:** Catalog / library / wishlist mount one `client:only="react"` actions island per list row (sibling of `MediaItemRow`). That was required after Astro slot hydration failures and workerd `client:load` invalid-hook-call issues. Large lists multiply React mounts; actions stay blank until JS.

**Follow-up:** Once a hydration-safe pattern is proven, collapse assignment actions into a single list-level island (or shared parent) instead of per-row mounts. Keep `MediaItemRow` meta-only / sibling contract from the plan addendum. Prefer revisiting when pagination or larger list UX lands.
