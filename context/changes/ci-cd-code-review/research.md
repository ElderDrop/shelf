---
date: 2026-09-11T21:33:46+00:00
researcher: Auto
git_commit: e782326954448e45b2792c8475d6e3cfaea481dd
branch: master
repository: ElderDrop/shelf
topic: "CI/CD PR code review via GHA + existing Cursor SDK agent"
tags: [research, codebase, github-actions, code-review-agent, promptfoo]
status: complete
last_updated: 2026-09-11
last_updated_by: Auto
---

# Research: CI/CD PR code review

**Date**: 2026-09-11T21:33:46+00:00
**Researcher**: Auto
**Git Commit**: e782326954448e45b2792c8475d6e3cfaea481dd
**Branch**: master
**Repository**: ElderDrop/shelf

## Research Question

Based on `context/changes/ci-cd-code-review/requirements.md`, how do we wire the existing `@10x/code-review-agent` into GitHub Actions (composite action + PR workflow), and what gaps must close for title/body/diff inputs, labels, comments, retry-on-label, and promptfoo evals?

## Summary

Shelf already has a local Cursor SDK reviewer (`packages/code-review-agent`) with five scored criteria and Zod-validated JSON. CI today only runs lint/test/build (`ci.yml`) and deploy (`deploy.yml`) — no review job, no `.github/actions/`. The MVP is: extend the CLI for PR context + `GITHUB_OUTPUT` + fail-on-verdict, wrap it in a local composite action, add `review.yml` for PR + `ai-cr:review` label, and add promptfoo with a custom provider that shells out to the same CLI (no OpenRouter required).

## Detailed Findings

### Existing GitHub Actions

- `.github/workflows/ci.yml` — `push`/`pull_request` → `master`; Node hardcoded `22`; secrets `SUPABASE_*` only for build.
- `.github/workflows/deploy.yml` — `push` → `master`; uses `CLOUDFLARE_API_TOKEN`.
- No top-level `permissions:` blocks; no `.github/actions/` yet.
- Convention: keep Node `22` to match CI (`.nvmrc` is `22.14.0`).

### Code-review agent

- Entry: `packages/code-review-agent/src/review.ts` — stdin diff → `Agent.prompt` → `parseReviewJson` → stdout JSON.
- Schema/prompt: `src/review-schema.ts` — five scores + `verdict` + `summary`.
- Env: `CURSOR_API_KEY` (required), `CURSOR_REVIEW_MODEL` (default `composer-2.5`).
- Gaps vs requirements: no PR title/body, always exit 0 on `fail`, no `GITHUB_OUTPUT`, no GitHub side-effects, `tools: []`.

### Promptfoo / evals

- Not in the repo. No OpenRouter wiring in app code.
- Best fit: custom provider spawning `npm run review` with `CURSOR_REVIEW_MODEL`, assertions on JSON + `verdict`/`securitySafety`.
- Existing fixture `fixtures/sample.diff` is a good insecure-auth fail case; need a richer React-migration fixture for LLM-rubric style checks.

### Permissions / secrets for PR side-effects

```yaml
permissions:
  contents: read
  pull-requests: write
  issues: write
```

Repository secret needed: `CURSOR_API_KEY`. Labels: `ai-cr:passed`, `ai-cr:failed`, `ai-cr:review`.

## Code References

- `packages/code-review-agent/src/review.ts` — CLI + SDK call
- `packages/code-review-agent/src/review-schema.ts` — criteria + Zod
- `.github/workflows/ci.yml` — existing CI pattern
- `package.json` — root `review` / `review:sample` scripts
- `.env.example` — `CURSOR_API_KEY` docs

## Architecture Insights

- Treat CI review like product code: package owns scoring contract; composite action owns CI glue; workflow owns triggers and GitHub side-effects.
- Keep agent on Cursor SDK (already integrated) rather than rewriting to Vercel AI SDK / Claude Action.
- Prefer local composite action (`.github/actions/ai-reviewer`) before extracting to a separate repo.
- Pin third-party actions to major tags already used (`@v4`); for any external AI action later, pin to SHA.
- Fork PRs will not receive `CURSOR_API_KEY` — same-repo PRs only for MVP.

## Historical Context (from prior changes)

- No prior `ci-cd-code-review` archive; this is the first change for AI review in GHA.
- Product conventions for review criteria come from Shelf stack (Astro SSR, RLS, share links) documented in `AGENTS.md` / `CLAUDE.md`.

## Related Research

- None under this change-id previously.

## Open Questions

1. Should the review job be a **required** status check (hard merge gate) or advisory (comment + labels only)? Recommendation for MVP: fail the job on `verdict=fail` so it *can* be required, but do not mark required in branch protection until the team agrees.
2. Confirm `CURSOR_API_KEY` is added as a GitHub Actions repository secret (local `.env` already has it).
3. Which Cursor model ids to bake off in promptfoo besides `composer-2.5` (needs account-available models).
