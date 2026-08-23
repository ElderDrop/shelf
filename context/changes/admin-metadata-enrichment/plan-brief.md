# Admin Metadata Enrichment — Plan Brief

> Full plan: `context/changes/admin-metadata-enrichment/plan.md`

## What & Why

S-03 was going to add automated metadata enrichment (FR-005). The admin will type catalog fields instead; automation is a later nice-to-have. This change demotes FR-005 and parks the slice so MVP is not blocked on a scraper.

## Starting Point

Catalog rows are title, description, tags, and status. S-01 (planned) is the manual admin form. No provider, job table, or service-role client exists. The roadmap still lists S-03 as blocked on “which source.”

## Desired End State

MVP admin work is create/edit/approve by hand. FR-005 remains in the PRD as **later**. S-03 sits in **Parked** with Change ID `admin-metadata-enrichment` and can be un-parked at any time. S-02 and later slices do not wait on it.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| -------- | ------ | ---------------- | ------ |
| Live enrichment in this change | None — park S-03 | Manual entry is S-01; a second slice with no API is duplicate work | Plan |
| FR-005 priority | later | Product owner: automation is nice-to-have, not MVP | Plan |
| Roadmap shape | Parked, keep Change ID | Same id to un-park anytime; drop from At a glance / Stream A | Plan |
| Doc depth | PRD + roadmap only | Infra/shape/idea still describe a future FR-005; no sweep | Plan |
| Provider (Open Library, etc.) | Undecided | Returns when the slice is un-parked | Plan |
| Apply / failure UX | Not in this change | No live lookup | Plan |

## Scope

**In scope:**

- PRD: FR-005 → later; MVP success, guardrails, admin role, business logic without automation
- Roadmap: park S-03, repair Stream A / unlocks / parallels / open questions

**Out of scope:**

- App code, Open Library, Queues, service role
- `infrastructure.md`, `shape-notes.md`, `docs/idea.md`, S-01 plan edits

## Architecture / Approach

No runtime architecture. PRD is the source of truth for MVP; the roadmap index is updated to match. Un-parking later is `/10x-plan admin-metadata-enrichment` after S-01 exists (catalog item + admin UI).

## Phases at a Glance

| Phase | What it delivers | Key risk |
| ----- | ---------------- | -------- |
| 1. PRD demotion | FR-005 later; MVP wording is manual admin | Leftover vision/success sentences still promise scraping |
| 2. Roadmap park | S-03 parked, optional, stable Change ID | Graph still lists S-03 as parallel/unlock/blocker |

**Prerequisites:** None for this docs change. Un-parking later needs S-01.
**Estimated effort:** One short session, two phases.

## Open Risks & Assumptions

- `infrastructure.md` still talks about Queues for FR-005 — intentional leftover for a future un-park.
- S-01 plan still says “enrichment is S-03”; that remains correct.
- Source/API is still unknown; parking removes it as a **blocker**, not as a future decision.

## Success Criteria (Summary)

- A reader of the PRD would not build a scraper to finish MVP.
- S-03 is parked, revivable by Change ID, and does not gate S-02 / S-04 / S-05.
