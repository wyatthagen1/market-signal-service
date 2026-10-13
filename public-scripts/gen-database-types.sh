#!/usr/bin/env bash
# Regenerate src/types/database/_generated/database.types.ts from the live remote schema.
# Mirrors the trading platform's public-scripts/gen-database-types.sh, with sweep_maker added.
#
# The CLI silently omits a requested schema that does not exist (exit 0), so each schema is
# checked in the output afterwards. Missing schemas are reported, not fatal: sweep_maker
# lands with the Sweep Catcher migrations, after this repo exists.
#
# Usage:  ./public-scripts/gen-database-types.sh [--db-url <postgres url>]
#   --db-url  generate from a local database (e.g. prod_mirror) instead of the remote project;
#             the CLI needs a running local stack and a supabase/config.toml in the cwd

set -euo pipefail

PROJECT_REF="tfehljavzzoposshkluz"
OUT_DIR="src/types/database/_generated"
OUT_FILE="$OUT_DIR/database.types.ts"
SCHEMAS=(public trading kalshi_state accounting sweep_maker)

if [[ "${1:-}" == "--db-url" ]]; then
    SOURCE=(--db-url "$2")
else
    SOURCE=(--project-id "$PROJECT_REF")
fi

SCHEMA_ARGS=()
for s in "${SCHEMAS[@]}"; do SCHEMA_ARGS+=(--schema "$s"); done

mkdir -p "$OUT_DIR"
TMP_FILE="$(mktemp)"
trap 'rm -f "$TMP_FILE"' EXIT

echo "Generating database types..."
supabase gen types typescript "${SOURCE[@]}" "${SCHEMA_ARGS[@]}" > "$TMP_FILE"
mv "$TMP_FILE" "$OUT_FILE"

missing=()
for s in "${SCHEMAS[@]}"; do
    grep -qE "^  ${s}: \{" "$OUT_FILE" || missing+=("$s")
done

echo "Wrote $(wc -l < "$OUT_FILE" | tr -d ' ') lines to $OUT_FILE"
if (( ${#missing[@]} > 0 )); then
    echo "WARNING: schema(s) absent from the database, no types generated: ${missing[*]}" >&2
fi
