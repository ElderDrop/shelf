---
bootstrapped_at: 2026-05-22T20:51:27Z
starter_id: 10x-astro-starter
starter_name: "10x Astro Starter (Astro + Supabase + Cloudflare)"
project_name: shelf
language_family: js
package_manager: npm
cwd_strategy: git-clone
bootstrapper_confidence: first-class
phase_3_status: ok
audit_command: "npm audit --json"
---

## Hand-off

```yaml
starter_id: 10x-astro-starter
package_manager: npm
project_name: shelf
hints:
  language_family: js
  team_size: solo
  deployment_target: cloudflare-pages
  ci_provider: github-actions
  ci_default_flow: auto-deploy-on-merge
  bootstrapper_confidence: first-class
  path_taken: standard
  quality_override: false
  self_check_answers: null
  has_auth: true
  has_payments: false
  has_realtime: false
  has_ai: false
  has_background_jobs: true
```

Shelf to web-app na małą skalę, 3 tygodnie po godzinach, z obowiązkowym auth (FR-001) i panelem admina do zatwierdzania katalogu oraz wzbogacania metadanych (FR-005–006). Standardowa ścieżka dla `(web-app, js)` wskazuje 10x-astro-starter: TypeScript, Supabase (auth + PostgreSQL) i deploy na Cloudflare Pages — wszystkie cztery bramki agent-friendly spełnione, bootstrapper first-class. Płatności, realtime i AI są poza zakresem PRD. Długie zadania wzbogacania metadanych mogą wymagać osobnego workerów poza edge — to świadomy koszt MVP, nie powód zmiany startera na tym etapie. CI: GitHub Actions, auto-deploy po merge.

## Pre-scaffold verification

| Signal      | Value                                              | Severity | Notes                                      |
| ----------- | -------------------------------------------------- | -------- | ------------------------------------------ |
| npm package | not run                                            | —        | `cmd_template` uses `git clone`, not npm create |
| GitHub repo | przeprogramowani/10x-astro-starter pushed 2026-05-17 | fresh    | via GitHub API (gh CLI unavailable)        |

## Scaffold log

**Resolved invocation**: `git clone https://github.com/przeprogramowani/10x-astro-starter .bootstrap-scaffold && cd .bootstrap-scaffold && npm install`

**Strategy**: git-clone

**Exit code**: 0

**Files moved**: all scaffold artifacts (including `node_modules`, 778 npm packages installed)

**Conflicts (.scaffold siblings)**: none

**.gitignore handling**: moved silently (no pre-existing `.gitignore` in cwd)

**.bootstrap-scaffold cleanup**: deleted

`context/` in cwd preserved (no `context/` path in upstream starter).

## Post-scaffold audit

**Tool**: npm audit --json

**Summary**: 0 CRITICAL, 1 HIGH, 9 MODERATE, 0 LOW

**Direct vs transitive**: not distinguished by this tool for all entries; `devalue` (HIGH) is transitive via Astro/Svelte toolchain

#### CRITICAL findings

(none)

#### HIGH findings

- **devalue** (5.6.3–5.8.0) — GHSA-77vg-94rm-hx3p: DoS via sparse array deserialization. Fix available via dependency updates (`npm audit fix` may apply).

#### MODERATE findings

- **@astrojs/check** / **@astrojs/language-server** — via volar-service-yaml / yaml-language-server chain
- **@cloudflare/vite-plugin**, **miniflare**, **wrangler** — via **ws** (GHSA-58qx-3vcg-4xpx)
- **yaml** / **yaml-language-server** — stack overflow in nested YAML (GHSA-48c2-rrv3-qjmp)

(Full JSON output captured at run time; 10 total vulnerabilities per npm metadata.)

#### LOW / INFO findings

(none)

## Hints recorded but not acted on

| Hint                    | Value                |
| ----------------------- | -------------------- |
| bootstrapper_confidence | first-class          |
| quality_override        | false                |
| path_taken              | standard             |
| self_check_answers      | null                 |
| team_size               | solo                 |
| deployment_target       | cloudflare-pages     |
| ci_provider             | github-actions       |
| ci_default_flow         | auto-deploy-on-merge |
| has_auth                | true                 |
| has_payments            | false                |
| has_realtime            | false                |
| has_ai                  | false                |
| has_background_jobs     | true                 |

v1 does not scaffold CI workflows, generate agent memory files beyond what the starter ships, or branch scaffold layout on feature flags.

## Next steps

Next: a future skill will set up agent context (CLAUDE.md, AGENTS.md). For now, your project is scaffolded and verified — happy hacking.

Useful manual steps in the meantime:

- `git init` (if you have not already) to start your own repo history.
- Review any `.scaffold` siblings the conflict policy created and decide which version of each file to keep (none this run).
- Copy `.env.example` to `.env` and configure Supabase / Cloudflare per starter README.
- Address audit findings per your project's risk tolerance — consider `npm audit fix` for the HIGH `devalue` advisory.
- Run `npm run dev` from `/workspaces/10x` to verify the Astro app locally.
