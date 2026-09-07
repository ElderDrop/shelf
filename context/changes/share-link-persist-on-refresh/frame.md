# Frame Brief: Share URL not re-copyable after library refresh

> Framing step before /10x-plan. This document captures what is *actually*
> at issue, separated from what was initially assumed.

## Reported Observation

After refreshing the library page, the share link appears gone from the UI and the user cannot revoke or copy that link again.

## Initial Framing (preserved)

- **User's stated cause or approach**: The share link is not preserved between sessions / refreshes.
- **User's proposed direction**: Keep the user’s share link available between sessions so revoke/copy still work after refresh.
- **Pre-dispatch narrowing**: Leading concern — after refresh the UI looks like there is no active share (create/generate again; no revoke/copy).

## Dimension Map

The observation could originate at any of these dimensions:

1. **Status restore failure** — GET `/api/share` fails or returns `active: false` despite a DB row → literal “No active share link” / Generate only
2. **UX vs intended active state** — GET returns `active: true`; UI shows active + Revoke + Regenerate but no URL/Copy → feels like the link “vanished”  ← initial “preserve” framing (partial)
3. **Hash-only token design** — plaintext token never stored; URL only returned on create/rotate and held in React state → cannot re-show the same URL after reload without regenerating
4. **True data loss** — `share_links` row deleted or invalidated by refresh alone

## Hypothesis Investigation

| Hypothesis | Evidence | Verdict |
| --- | --- | --- |
| Status restore failure | Inactive copy only when GET returns `active: false` (`ShareLinkControls.tsx:189`). User reports “Share link is active” + Revoke after refresh → rules out. | NONE (for this report) |
| UX vs intended active state | Mount GET sets status only (`ShareLinkControls.tsx:48-58`); `url` stays null → Copy hidden (`191-215`); active + Revoke still render (`176-229`). Matches user Q1=A. | STRONG |
| Hash-only token design | Schema stores `token_hash` only (`20260906120000_share_links.sql`); GET returns `{ active, created_at }` (`api/share.ts:34-38`); plan documents token-once / regenerate to re-copy (`readonly-share-link/plan.md` Critical details ~L24, ~L53, Phase 3 ~L186). | STRONG |
| True data loss | Refresh does not DELETE; user confirms prior public URL still works (Q2=A); `resolveShareByToken` still hashes and looks up row. | NONE |

## Narrowing Signals

Decisive observations from Step 4 (user reports + code investigation):

- After refresh: **“Share link is active”** and **Revoke** visible; **no URL / Copy** (not the inactive branch).
- Previously copied public URL **still works** for visitors.
- Primary pain: **cannot get the same URL back to copy** without regenerating (not “cannot revoke”).

## Cross-System Convention

Independent pass (no named hypothesis) landed on the same mechanism: raw token only on POST + in-memory `url`; GET is status-only by design. Prior change `readonly-share-link` explicitly chose hash storage and “after reload, Copy needs Regenerate.” That convention matches the leading hypothesis; it also explains why “preserve between sessions” was a misread of a deliberate token-once product choice, not a persistence bug.

## Reframed (or Confirmed) Problem Statement

> **The actual problem to plan around is**: After reload, the owner cannot re-disclose the *existing* share URL for copying, because the system only ever returns the raw token on create/rotate and stores only a hash — while the share itself remains active, revocable, and valid for visitors.

The initial framing (“link not preserved / vanishes”) does not hold as data loss or missing revoke. What vanishes is the **copyable URL string** in the UI. Regenerating reveals a *new* URL and invalidates the old one, which conflicts with the user’s primary need (re-copy the same link). Addressing this means planning for owner re-access to the current URL (or an explicit product decision that regenerate-only is acceptable) — not fixing session persistence of the `share_links` row.

## Confidence

- **HIGH** — strong code + plan evidence, independent confirmation, and decisive user narrowing (active UI + working public URL + re-copy pain).

## What Changes for /10x-plan

Plan around **owner re-copy / re-disclosure of the current share URL after reload** (product + security tradeoffs of showing the same token again vs alternatives). Do **not** plan a “fix share deleted on refresh” persistence bug — the row and public resolve already survive refresh; revoke already works when status is active.

## References

- Source files: `src/components/share/ShareLinkControls.tsx:48-58,176-229`; `src/pages/api/share.ts:34-38,54-61`; `src/lib/services/share.ts:104-119`; `supabase/migrations/20260906120000_share_links.sql`; `context/changes/readonly-share-link/plan.md` (token handling / Phase 3)
- Related research: none (`research.md` not present)
- Investigation: explore agents for UI refresh path, API status contract, GET-fail hypothesis, UX vs design, independent observation pass
