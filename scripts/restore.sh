#!/usr/bin/env bash
# Restores a backup made by backup.sh. DESTRUCTIVE: replaces the current database (and files if given).
# Usage: scripts/restore.sh <db-*.dump> [files-*.tar.gz]
set -euo pipefail

cd "$(dirname "$0")/.."
DC=(docker compose --env-file .env.prod -f docker-compose.prod.yml ${COMPOSE_PROJECT:+-p "$COMPOSE_PROJECT"})

db_file="${1:?usage: $0 <db-dump> [files-archive]}"
files_file="${2:-}"
[[ -f "$db_file" ]] || { echo "not found: $db_file" >&2; exit 1; }

echo "This REPLACES the live database${files_file:+ and uploaded files} with:"
echo "  $db_file${files_file:+ + $files_file}"
read -r -p "Type 'restore' to continue: " answer
[[ "$answer" == "restore" ]] || { echo "aborted"; exit 1; }

echo "stopping app and worker"
"${DC[@]}" stop app worker

echo "restoring database"
"${DC[@]}" exec -T postgres pg_restore -U gombe -d gombejobs --clean --if-exists --no-owner < "$db_file"

if [[ -n "$files_file" ]]; then
  echo "restoring files"
  "${DC[@]}" stop gcs
  docker run --rm -v "$PWD/dev/gcs":/data -v "$(cd "$(dirname "$files_file")" && pwd)":/in:ro alpine:3 \
    sh -c "rm -rf /data/* /data/.[!.]* 2>/dev/null; tar -xzf /in/$(basename "$files_file") -C /data"
  "${DC[@]}" start gcs
fi

echo "starting app and worker"
"${DC[@]}" start app worker
echo "restore complete"
