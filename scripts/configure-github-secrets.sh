#!/usr/bin/env bash
# Configure GitHub Actions secrets for CI build + deploy (plan Faza 2 / 4).
# Reads SUPABASE_URL, SUPABASE_KEY, CLOUDFLARE_API_TOKEN from repo-root .env.

set -euo pipefail

cd "$(dirname "$0")/.."
# shellcheck disable=SC1091
source scripts/load-env.sh

if ! git remote get-url origin &>/dev/null; then
  echo "No git remote 'origin'. Add remote first, e.g.: git remote add origin <url>" >&2
  exit 1
fi

require_var() {
  if [[ -z "${!1:-}" ]]; then
    echo "Missing required env var: $1 (set it in .env)" >&2
    exit 1
  fi
}

require_var SUPABASE_URL
require_var SUPABASE_KEY
require_var CLOUDFLARE_API_TOKEN

echo "Setting GitHub repository secrets..."
printf '%s' "$SUPABASE_URL" | gh secret set SUPABASE_URL
printf '%s' "$SUPABASE_KEY" | gh secret set SUPABASE_KEY
printf '%s' "$CLOUDFLARE_API_TOKEN" | gh secret set CLOUDFLARE_API_TOKEN

echo "Secrets configured. CI (.github/workflows/ci.yml) and deploy (.github/workflows/deploy.yml) are ready."
