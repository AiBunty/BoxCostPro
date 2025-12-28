#!/usr/bin/env bash
# Replit DB migration helper (Bash)
# Usage: bash scripts/replit-migrate.sh

set -euo pipefail

echo "Starting Drizzle migration for Replit DB..."

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is not set. Add it in Replit Secrets or export it in your shell." >&2
  exit 1
fi

echo "Using DATABASE_URL: ${DATABASE_URL}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${SCRIPT_DIR}/.."
cd "${PROJECT_ROOT}"

npm run db:push

echo "Migration applied successfully."