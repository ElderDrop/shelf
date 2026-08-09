---
starter_id: 10x-astro-starter
package_manager: npm
project_name: shelf
hints:
  language_family: js
  team_size: solo
  deployment_target: cloudflare-workers
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
---

## Why this stack

Shelf to web-app na małą skalę, 3 tygodnie po godzinach, z obowiązkowym auth (FR-001) i panelem admina do zatwierdzania katalogu oraz wzbogacania metadanych (FR-005–006). Standardowa ścieżka dla `(web-app, js)` wskazuje 10x-astro-starter: TypeScript, Supabase (auth + PostgreSQL) i deploy na Cloudflare Pages — wszystkie cztery bramki agent-friendly spełnione, bootstrapper first-class. Płatności, realtime i AI są poza zakresem PRD. Długie zadania wzbogacania metadanych mogą wymagać osobnego workerów poza edge — to świadomy koszt MVP, nie powód zmiany startera na tym etapie. CI: GitHub Actions, auto-deploy po merge.
                                            