## Overall concept

- GHA workflow run for every new pull request to master
- composite action for the review itself so that main workflow is easy to reason about
- Reuse existing `@10x/code-review-agent` (Cursor SDK) rather than rewriting on Vercel AI SDK / Claude Action

## Input parameters

- pull request title
- pull request description (cost tradeoff: include body; truncate if huge)
- git diff (full history checkout required)

## Code Review Criteria

Each criterion is scored on a 1–10 scale, where 1 is the worst outcome and 10 is the best.

### 1. Implementation correctness (`implementationCorrectness`)

- **1:** Change does not do what the PR claims; broken SSR/API contracts; silent wrong behavior on happy path.
- **10:** Behavior matches title/body; API handlers, Astro pages, and data paths are coherent; edge cases handled without inventing scope.

### 2. Idiomaticity (`idiomaticity`)

- **1:** Fights the stack (Next.js `"use client"`, hand-concatenated Tailwind, secrets in client code, wrong layering).
- **10:** Fits Shelf conventions: Astro layouts + React islands only when interactive, `@/*` imports, `cn()`, Zod on API bodies, `prerender = false` on API routes, services in `src/lib/`.

### 3. Complexity (`complexity`)

- **1:** Over-engineered for the problem; unnecessary abstractions; hard to follow control flow.
- **10:** Simplest design that solves the stated problem; complexity proportional to risk.

### 4. Test / risk coverage (`testRiskCoverage`)

- **1:** Risky paths (authz, RLS, share tokens, admin gates) changed with no tests and no justification.
- **10:** Tests (or explicit risk notes) cover the risky paths touched; cheap layer preferred per `context/foundation/test-plan.md` when present.

### 5. Security & safety (`securitySafety`)

- **1:** Secrets leaked, RLS bypassed casually, share-link mutation, service-role used outside narrow server paths.
- **10:** No secrets in diff; authz/RLS respected; privileged clients (`supabase-service`) only on justified server paths; share links stay read-only.

## Verdict rule

- Bind `verdict` to overall quality: prefer `fail` when any criterion is ≤ 3, or when security/correctness is clearly broken.
- Prefer `pass` only when all scores are ≥ 5 and no critical security/correctness issue remains.

## Parked for later

- business alignment (require broader context)
- architectural fit (require broader context / plan.md tool loop)

## Expected side-effects

- PR comment with summary (Markdown from agent `summary`)
- labels: `ai-cr:failed` (red) OR `ai-cr:passed` (green) — mutually exclusive

## Expected behavior

- on-demand retry when label `ai-cr:review` is added
- workflow also supports `workflow_dispatch` for manual dry runs where possible
