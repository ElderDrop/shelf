---
change_id: ui-polish
title: Ui polish
status: implemented
created: 2026-09-11
updated: 2026-09-11
archived_at: null
---

## Notes

Home page (`/`) should briefly describe what can be done on the site (catalog → library/wishlist, recommendations, read-only share) — not a full marketing redesign.

Phase 2: do not nest `client:*` React islands inside `MediaItemRow` slots — Astro drops hydration; keep islands as page-level siblings of the meta component. `Badge` must import `Slot` from `@radix-ui/react-slot` (not `radix-ui`) or catalog action islands fail to load in Vite. Prefer `client:only="react"` for assignment islands — `client:load` SSR hits invalid-hook-call under Cloudflare workerd.

Visual system (revised): light brown / beige / white / black — parchment page (`background`), white surfaces (`card`), near-black type (`foreground`), walnut brown accent (`primary`). Product, auth, home, and dashboard use semantic tokens + `shelf-page` / `shelf-panel`.
