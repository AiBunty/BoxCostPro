#!/usr/bin/env bash
# Schema-only dump helper for Replit DB
# Usage: bash scripts/db-schema-dump.sh

set -euo pipefail

OUTPUT_DIR="attached_assets"
OUTPUT_SCHEMA="${OUTPUT_DIR}/schema.sql"
OUTPUT_TABLES="${OUTPUT_DIR}/schema_tables.txt"
OUTPUT_COLUMNS="${OUTPUT_DIR}/schema_columns.txt"

mkdir -p "${OUTPUT_DIR}"

echo "Starting schema export..."

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is not set. Add it in Replit Secrets or export it in your shell." >&2
  exit 1
fi

# Try pg_dump first
if command -v pg_dump >/dev/null 2>&1; then
  echo "Using pg_dump to write ${OUTPUT_SCHEMA}"
  pg_dump --schema-only --no-owner --no-privileges "${DATABASE_URL}" > "${OUTPUT_SCHEMA}"
  echo "Schema dump saved to ${OUTPUT_SCHEMA}"
else
  echo "pg_dump not found; falling back to psql queries"
  # Tables list
  psql "${DATABASE_URL}" -c "\\dt" > "${OUTPUT_TABLES}"
  # Columns/types list
  psql "${DATABASE_URL}" -c "SELECT table_name, column_name, data_type FROM information_schema.columns ORDER BY table_name, ordinal_position;" > "${OUTPUT_COLUMNS}"
  echo "Tables saved to ${OUTPUT_TABLES}"
  echo "Columns/types saved to ${OUTPUT_COLUMNS}"
fi

echo "Schema export complete."