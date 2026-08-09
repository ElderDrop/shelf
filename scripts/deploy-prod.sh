#!/usr/bin/env bash
# Deploy Shelf starter to Cloudflare Workers (manual prod deploy — plan Faza 3).
# Reads CLOUDFLARE_API_TOKEN, SUPABASE_URL, SUPABASE_KEY from repo-root .env.

set -euo pipefail

cd "$(dirname "$0")/.."
# shellcheck disable=SC1091
source scripts/load-env.sh

require_var() {
  if [[ -z "${!1:-}" ]]; then
    echo "Missing required env var: $1 (set it in .env)" >&2
    exit 1
  fi
}

require_var CLOUDFLARE_API_TOKEN
require_var SUPABASE_URL
require_var SUPABASE_KEY

echo "Setting Wrangler secrets..."
printf '%s' "$SUPABASE_URL" | npx wrangler secret put SUPABASE_URL
printf '%s' "$SUPABASE_KEY" | npx wrangler secret put SUPABASE_KEY

echo "Building..."
npm run build

echo "Deploying to Cloudflare Workers..."
npx wrangler deploy

echo ""
echo "Deploy complete. Next steps:"
echo "  1. Worker URL: https://<worker-name>.<account>.workers.dev (see wrangler output above)"
echo "  2. Supabase Dashboard → Authentication → URL Configuration:"
echo "     Site URL = your Worker URL (e.g. https://shelf.kij242.workers.dev)"
echo "     Redirect URLs = Worker URL and https://<worker-url>/auth/**"
echo "  3. Smoke test: signup → signin → /dashboard → signout"
echo "  4. Logs: npx wrangler tail"
