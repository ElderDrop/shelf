# Admin Metadata Enrichment — Park Slice Implementation Plan

## Overview

Demote automated metadata enrichment from MVP. Admin seeds the catalog by typing title, description, and tags (S-01 / FR-004). FR-005 becomes **later**; S-03 stays under Change ID `admin-metadata-enrichment` but moves to **Parked**, off the critical path, and can be un-parked at any time.

## Current State Analysis

S-03 was the blocked admin-stream slice for FR-005 (must-have): run scraping / tag suggestions on a catalog item and review before approval. The blocking unknown was the external source.

No enrichment code exists. `catalog_items` is `title`, `description`, `tags`, `status` (`supabase/migrations/20260608120000_catalog_schema.sql`). F-01 and S-01 already deferred providers, job tables, and `SUPABASE_SERVICE_ROLE_KEY` to this slice. S-01’s planned admin form is the manual path; this change does not wait on that code.

Infrastructure still describes Cloudflare Queues for FR-005 (`context/foundation/infrastructure.md`). That file is out of scope here; it remains valid **when** the slice is un-parked.

### Key Discoveries:

- FR-005 is the only must-have that promises automation (`context/foundation/prd.md:89`).
- MVP success path 3, a secondary success bullet, an auditability guardrail, business-logic “W produkcie”, and the admin access-control sentence all assume enrichment is in the first version (`prd.md:42`, `:51`, `:58`, `:114`, `:120`).
- Roadmap Stream A is `F-01 → S-01 → S-03`; S-02 lists S-03 as **Parallel with**; F-01 **Unlocks** includes S-03; Open Question 2 blocks S-03 (`roadmap.md:35`, `:45`, `:68`, `:97`, `:154`).
- Open Library (JSON, no key, CC0, human lookup) is a plausible later provider; it is **not** chosen or implemented in this change.

## Desired End State

After this plan completes:

1. FR-005 is still in the PRD with the same behavior (enrich + review before approval) but **Priority: later**. MVP admin work is FR-004 + FR-006 only.
2. MVP success, guardrails, business logic, and access control no longer require automation.
3. S-03 is in the roadmap **Parked** section with Change ID `admin-metadata-enrichment`, status `later`. It can be un-parked and `/10x-plan`’d at any moment; other slices do not wait on it. When un-parked it still needs S-01’s catalog item + admin UI to attach to.
4. Stream A is `F-01 → S-01`. F-01 unlocks S-01 and S-02 only. S-02 has no parallel S-03. The scraping-source question no longer blocks the roadmap.

**Verification:** grep the two foundation files for the contracts below; a human reads PRD + roadmap for leftover “MVP includes enrichment” wording.

## What We're NOT Doing

- Any application code, migrations, APIs, Enrich button, or provider (Open Library or otherwise).
- Cloudflare Queues, cron, service-role client, or scrape/job tables.
- Editing `context/foundation/infrastructure.md`, `shape-notes.md`, `docs/idea.md`, `tech-stack.md`, or S-01’s plan (its “enrichment is S-03” notes stay true: enrichment is not S-01).
- Deleting Change ID `admin-metadata-enrichment` or FR-005.
- Picking an external source. That decision returns when the slice is un-parked.

## Implementation Approach

Docs-only, PRD first so the roadmap park cannot drift from requirements. Two reviewable phases: rewrite MVP wording around FR-005, then move the slice out of the delivery sequence while keeping a stable ID for a later pickup.

## Phase 1: Demote FR-005 in the PRD

### Overview

Make the PRD describe an MVP whose admin path is manual create/edit + approve. Keep FR-005 as a later requirement, including review-before-approval.

### Changes Required:

#### 1. Vision (MVP vs later)

**File**: `context/foundation/prd.md`

**Intent**: Stop promising semi-automatic enrichment as the way Shelf lowers the barrier in the first version.

**Contract**: In **Vision & Problem Statement**, keep the curated, admin-approved catalog. Do not present półautomatyczne wzbogacanie as an MVP capability. If enrichment is mentioned, mark it as later (FR-005), not as current product behavior.

#### 2. MVP success path and secondary success

**File**: `context/foundation/prd.md`

**Intent**: Admin success is create/edit by hand, then approve.

**Contract**:

- Primary success step 3: admin **manually** adds or edits a catalog item (title, description, tags) and approves it before it is user-visible. No “or automation” in the MVP path.
- Secondary success: remove the bullet that enrichment is faster than filling fields. Keep the recommendations-at-small-collection bullet.

#### 3. Guardrails

**File**: `context/foundation/prd.md`

**Intent**: Auditability of automation is a later FR-005 constraint, not an MVP guardrail.

**Contract**: Delete the MVP Guardrails bullet “Automatyzacja wzbogacania metadanych jest audytowalna…”. Fold that constraint into FR-005’s later statement (Socrates or a one-line note under FR-005) so it is not lost.

#### 4. FR-004 and FR-005 priority and Socrates

**File**: `context/foundation/prd.md`

**Intent**: Manual admin entry is the MVP catalog path; automation is postponed, not dropped.

**Contract**:

- FR-005: `Priority: later`. Update the Socrates resolution: no longer “kept for MVP”; record that MVP uses FR-004 + FR-006, and FR-005 can be picked up any time after S-01 exists.
- FR-004 Socrates: manual entry is the **MVP path**, not merely a fallback for failed automation.

#### 5. Business logic and access control

**File**: `context/foundation/prd.md`

**Intent**: Admin MVP duties are type fields and approve/reject.

**Contract**:

- **Wejścia (admin):** typed title/description/tags and an approve/reject decision — not “surowe źródło metadanych”.
- **W produkcie:** quality via manual correction + approval. Do not require automation in MVP.
- **Rola admina:** manual catalog create/edit and approval. Mention enrichment only as later FR-005.
- **Poza MVP:** add automated metadata enrichment (FR-005) alongside the existing parked items, or point at FR-005 later — do not duplicate a long spec.
- **Offline-first** non-goal: network is required for catalog and auth; do not imply admin scraping is in MVP.

### Success Criteria:

#### Automated Verification:

- `rg -n "Priority: later" context/foundation/prd.md` matches the FR-005 line
- `rg -n "Priority: must-have" context/foundation/prd.md` still matches FR-001–004 and FR-006–008, not FR-005
- `rg -n "półautomatyczne|automatycznym wzbogacaniem|ręcznie lub automatyzacja" context/foundation/prd.md` returns no MVP-path hits (FR-005 later text may still say “enrichment” / “review”)

#### Manual Verification:

- Reading **Success Criteria**, **Access Control**, and **Business Logic**, a new contributor would implement S-01 without building a scraper
- FR-005 is still present and still requires review before approval when eventually built

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Park S-03 on the roadmap

### Overview

Take S-03 off the MVP sequence. Keep the Change ID. Make it obvious the slice is optional and can be un-parked whenever.

### Changes Required:

#### 1. At a glance, streams, and graph

**File**: `context/foundation/roadmap.md`

**Intent**: No delivery index still lists S-03 as a next build.

**Contract**:

- Remove the S-03 row from **At a glance**.
- Stream A: `F-01 → S-01` only; note that admin seed is manual. Do not keep “ścieżka wzbogacania” as an MVP stream goal.
- F-01 **Unlocks:** `S-01, S-02` (drop S-03).
- S-02 **Parallel with:** `—` (drop S-03).
- Remove `### S-03: Admin metadata enrichment` from **Slices**.

#### 2. Parked entry (stable ID)

**File**: `context/foundation/roadmap.md`

**Intent**: Preserve a one-block revival path so `/10x-plan admin-metadata-enrichment` can run later without inventing a new id.

**Contract**: Add under **Parked**:

- **Admin metadata enrichment (S-03 / FR-005)** — Why parked: demoted from MVP; admin types catalog fields (S-01). **Change ID:** `admin-metadata-enrichment`. **Status:** later. **Un-park:** any time; not a blocker for S-02, S-04, or S-05. When un-parked, prerequisite is S-01 (pending catalog item + admin edit UI). Source/API still undecided at park time.

#### 3. Backlog handoff and open questions

**File**: `context/foundation/roadmap.md`

**Intent**: Stop telling people S-03 is blocked-and-waiting in the active backlog.

**Contract**:

- **Backlog Handoff:** remove the S-03 row, or rewrite Notes to “parked — un-park any time; not MVP” and Ready for `/10x-plan`: no. Prefer **remove** so the table is only active slices.
- **Open Roadmap Questions:** remove item 2 (scraping source as a **block** on S-03). The parked bullet already says the source is undecided. Item 1 (NFR thresholds) stays.

#### 4. Vision recap

**File**: `context/foundation/roadmap.md`

**Intent**: Roadmap recap matches the demoted PRD.

**Contract**: Vision recap describes the curated, admin-approved catalog without MVP półautomatyczne wzbogacanie. Bump frontmatter `updated:` if the file date is not already today.

### Success Criteria:

#### Automated Verification:

- `rg -n "admin-metadata-enrichment" context/foundation/roadmap.md` hits the Parked section (and may hit this change’s own references — not At a glance, not Slices `### S-03`)
- `rg -n "^\| S-03 " context/foundation/roadmap.md` returns no At a glance row
- `rg -n "Parallel with: S-03" context/foundation/roadmap.md` returns no matches
- `rg -n "Block: S-03" context/foundation/roadmap.md` returns no matches

#### Manual Verification:

- Stream A and F-01 unlocks read as schema → admin CRUD/approval → (user slices), with no enrichment gate
- Parked S-03 can be revived by copying Change ID `admin-metadata-enrichment` into `/10x-plan` without editing the PRD FR number
- S-02, S-04, S-05 do not list S-03 as a prerequisite or blocker

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

None. No application code.

### Integration Tests:

None.

### Manual Testing Steps:

1. Read `context/foundation/prd.md` Success Criteria + FR-004/FR-005/FR-006 as if starting S-01.
2. Read `context/foundation/roadmap.md` At a glance + Streams + Parked and confirm S-03 is optional later work.
3. Confirm `context/foundation/infrastructure.md` still mentions Queues for FR-005 (expected; out of scope) so a future un-park still has that pointer.

## Performance Considerations

None. Documentation only.

## Migration Notes

None. No schema or deploy steps. Do not treat this change as permission to skip S-01.

## References

- PRD: `context/foundation/prd.md` — FR-004, FR-005, FR-006, Access Control, Guardrails
- Roadmap S-03: `context/foundation/roadmap.md`
- Manual admin path (prerequisite when un-parked): `context/changes/admin-catalog-approval/plan.md`
- Schema (no enrichment columns): `supabase/migrations/20260608120000_catalog_schema.sql`
- Queues pointer for a future un-park: `context/foundation/infrastructure.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Demote FR-005 in the PRD

#### Automated

- [ ] 1.1 `rg` shows FR-005 `Priority: later`
- [ ] 1.2 FR-001–004 and FR-006–008 remain `must-have`
- [ ] 1.3 MVP path no longer requires automation / półautomatyczne wzbogacanie

#### Manual

- [ ] 1.4 S-01 can be implemented from the PRD without a scraper
- [ ] 1.5 FR-005 still exists and still requires review before approval when built

### Phase 2: Park S-03 on the roadmap

#### Automated

- [ ] 2.1 Change ID `admin-metadata-enrichment` appears under Parked
- [ ] 2.2 No S-03 row in At a glance
- [ ] 2.3 S-02 is not parallel with S-03
- [ ] 2.4 Scraping source is not an open question that blocks S-03

#### Manual

- [ ] 2.5 Stream A and F-01 unlocks have no enrichment gate
- [ ] 2.6 Parked S-03 is revivable via Change ID `admin-metadata-enrichment`
- [ ] 2.7 S-02, S-04, S-05 do not wait on S-03
