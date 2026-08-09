#!/usr/bin/env bash
# Load repo-root .env (gitignored). Used by deploy/CI helper scripts.

set -a
if [[ -f .env ]]; then
  # shellcheck disable=SC1091
  source .env
fi
set +a
