# Review follow-ups — tag-recommendations

From `/10x-impl-review` (2026-08-30). Manual Progress rows closed via chat confirm; re-verify these in a running app when convenient.

## Spot-check checklist

### 2.4 — API eligible false (&lt; 3 tagged library items)

1. Sign in as a user with fewer than 3 library items that have tags (empty library is fine).
2. `GET /api/recommendations` with session cookie.
3. Expect `{ "data": { "eligible": false, "taggedLibraryCount": N, "items": [] } }` where `N < 3`.

**Evidence already on file:** unauthenticated call returns `401 {"error":"Unauthorized"}` (automated during impl + review).

### 4.3 — End-to-end assign-from-recommendation

1. Admin: ≥ 5 approved items with overlapping tags.
2. User: assign ≥ 3 tagged items to library.
3. Open `/library` — “Recommended for you” lists matches.
4. Add one recommendation to library → refresh → row gone from recommendations, present in library list.

### 4.5 — Scenario C exclusions

1. Assign item A to library, item B to wishlist; keep overlapping item C unassigned.
2. `GET /api/recommendations` and `/library` recommendations must never include A or B; C may appear if score &gt; 0.

## Already verified with artifacts

- Golden scorer A/B via `tsx` (order `x,y,z` and `r,p`)
- `npm run lint` / `npm run build`
- Unauth `GET /api/recommendations` → 401 JSON
