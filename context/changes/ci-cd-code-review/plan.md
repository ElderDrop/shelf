---
change_id: ci-cd-code-review
title: First CI/CD workflow for PR code reviews
status: planning
created: 2026-09-11
updated: 2026-09-11
---

# Plan: CI/CD code review

## Goal

Every PR to `master` (and on-demand via `ai-cr:review`) runs the existing Cursor SDK reviewer, posts a summary comment, sets pass/fail labels, and exposes a structured verdict for gating.

## Decisions (locked)

| Decision | Choice | Why |
|----------|--------|-----|
| Agent runtime | Keep `@10x/code-review-agent` (Cursor SDK) | Already works; `CURSOR_API_KEY` present |
| Action hosting | Local `.github/actions/ai-reviewer` | Lesson MVP; easy to extract later |
| Side-effects | Workflow steps via `gh` after action outputs | Thin action; easy to debug |
| Merge gate | Job fails on `verdict=fail` | Can become required check later |
| Plan context | Pre-inject `plan.md` when change-id detected | Deterministic; avoids tool-loop cost on CI |
| Evals | promptfoo + custom provider → same CLI | No OpenRouter needed |

## Criteria (5)

See `requirements.md`. Schema fields stay: `implementationCorrectness`, `idiomaticity`, `complexity`, `testRiskCoverage`, `securitySafety`, plus `verdict`, `summary`. Enrich SYSTEM_PROMPT with Shelf-specific 1/10 anchors and verdict rule (any ≤3 → prefer fail; security/correctness critical → fail).

## Implementation phases

### Phase 1 — Agent contract

1. Update `review-schema.ts`: Shelf anchors in prompt; Zod `.min(1).max(10)` on scores.
2. Update `review.ts`:
   - Inputs: `PR_TITLE`, `PR_BODY` (truncate body ~4k), stdin or `REVIEW_DIFF`/`REVIEW_DIFF_PATH`.
   - Optional: resolve change-id from `REVIEW_CHANGE_ID` or PR text → inject `context/changes/<id>/plan.md` when present.
   - Emit `GITHUB_OUTPUT` (`verdict`, multiline `summary`, scores).
   - Exit `1` on `verdict=fail`, `0` on pass; infra errors non-zero.
3. Export `buildReviewPrompt` / keep `parseReviewJson` for evals.

### Phase 2 — Composite action + workflow

1. `.github/actions/ai-reviewer/action.yml` — inputs: `api-key`, `pr-title`, `pr-body`, `diff`, optional `model`, `change-id`. Steps: setup node, `npm ci` in package, run review, map outputs.
2. `.github/workflows/review.yml`:
   - Triggers: `pull_request` → `master` (`opened`, `synchronize`, `reopened`); `pull_request` types `labeled` when label is `ai-cr:review`; `workflow_dispatch`.
   - `fetch-depth: 0`; compute `git diff origin/<base>...HEAD`.
   - Run composite action; comment with summary; swap labels `ai-cr:passed`/`ai-cr:failed`; remove `ai-cr:review` after run.
   - Permissions: `contents: read`, `pull-requests: write`, `issues: write`.
   - Secret: `CURSOR_API_KEY`.

### Phase 3 — promptfoo

1. Add `promptfoo` devDependency in package.
2. `evals/provider.ts` — spawn review with model from config.
3. `promptfooconfig.yaml` — 2–3 models; tests: `sample.diff` (expect fail) + new complex React 16→19 fixture with three flaws (LLM-rubric + static fail assert).
4. Script: `npm run eval` in package.

### Phase 4 — Docs / secrets

1. Document `CURSOR_API_KEY` secret + labels in README CI section / `.env.example`.
2. Create labels via `gh` if missing.

## Progress

- [x] Phase 1 — Agent contract
- [x] Phase 2 — Composite action + workflow
- [x] Phase 3 — promptfoo
- [x] Phase 4 — Docs / secrets / labels
- [x] Verify: local sample review + typecheck; promptfoo 100% on 2 models × 2 fixtures; YAML validated
