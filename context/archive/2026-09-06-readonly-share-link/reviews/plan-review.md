<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Read-Only Share Link Implementation Plan

- **Plan**: `context/changes/readonly-share-link/plan.md`
- **Mode**: Deep
- **Date**: 2026-09-06
- **Verdict**: SOUND (after triage fixes; was REVISE)
- **Findings**: 1 critical 3 warnings 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS (was WARNING; F5 addressed) |
| Blind Spots | PASS (was FAIL; F1 fixed) |
| Plan Completeness | PASS (was WARNING; F2–F4 fixed) |

## Grounding

Grounding: 10/10 existing paths ✓, new paths correctly absent ✓, symbols (createClient, PROTECTED_ROUTES, listForUser) ✓, brief↔plan ✓, Progress↔Phase ✓

## Findings

### F1 — Service-role resolve can leak unapproved catalog metadata

- **Severity**: ❌ CRITICAL
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Blind Spots
- **Location**: Critical Implementation Details + Phase 2 resolve contract
- **Detail**: Service role bypasses catalog RLS; copying session embed select without approved filter would leak pending/rejected metadata on the public share page.
- **Fix A ⭐ Recommended**: Nail approved-only resolve (`!inner`/omit); never `listForUser` + service client
- **Fix B**: Two-step assignments + approved catalog by IDs
- **Decision**: FIXED via Fix A

### F2 — Revoke model left as implementer choice

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Completeness
- **Location**: Phase 1 — Migration contract
- **Detail**: Soft-revoke vs delete-on-revoke was left open.
- **Fix A ⭐ Recommended**: Delete-on-revoke; UNIQUE(user_id)
- **Fix B**: Soft-revoke with revoked_at + partial unique
- **Decision**: FIXED via Fix A

### F3 — POST create vs regenerate underspecified

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Completeness
- **Location**: Phase 2 — Owner API contract
- **Detail**: Create vs regenerate verbs/status codes undefined vs assignments upsert pattern.
- **Fix**: GET status; POST create-or-rotate (201/200); DELETE revoke
- **Decision**: FIXED

### F4 — Absolute share URL origin not specified

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 — Create response / Token handling
- **Detail**: No site/SITE_URL helper; absolute URL host unspecified.
- **Fix**: Request origin + `/share/{token}` (or island + `window.location.origin`)
- **Decision**: FIXED

### F5 — SHA-256 is greenfield on this stack

- **Severity**: 💭 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architectural Fitness
- **Location**: Phase 2 — Token hashing
- **Detail**: No crypto.subtle usage in src/; name Web Crypto for workerd.
- **Fix**: Name `crypto.subtle.digest("SHA-256", …)` under Token handling
- **Decision**: FIXED (applied with F4)
