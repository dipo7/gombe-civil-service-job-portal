#!/usr/bin/env bash
# Nightly backup for the pilot VM: Postgres dump + uploaded files, kept locally for KEEP_DAYS.
# Run from cron on the VM. Optional off-box copy: set BACKUP_BUCKET (gs://bucket/path).
set -euo pipefail
umask 077

cd "$(dirname "$0")/.."
BACKUP_DIR="${BACKUP_DIR:-$HOME/backups}"
KEEP_DAYS="${KEEP_DAYS:-7}"
DC=(docker compose --env-file .env.prod -f docker-compose.prod.yml ${COMPOSE_PROJECT:+-p "$COMPOSE_PROJECT"})

stamp="$(date -u +%Y%m%dT%H%M%SZ)"
db_file="$BACKUP_DIR/db-$stamp.dump"
files_file="$BACKUP_DIR/files-$stamp.tar.gz"
mkdir -p "$BACKUP_DIR"

echo "[$stamp] dumping database"
"${DC[@]}" exec -T postgres pg_dump -U gombe -d gombejobs --format=custom > "$db_file.tmp"
# Reject a truncated or unreadable dump before it replaces anything.
"${DC[@]}" exec -T postgres pg_restore --list < "$db_file.tmp" > /dev/null
mv "$db_file.tmp" "$db_file"

echo "[$stamp] archiving uploaded files"
# A throwaway container reads the bind mount, which the storage container writes as root.
docker run --rm -v "$PWD/dev/gcs":/data:ro alpine:3 tar -czf - -C /data . > "$files_file.tmp"
mv "$files_file.tmp" "$files_file"

if [[ -n "${BACKUP_BUCKET:-}" ]]; then
  echo "[$stamp] copying off-box to $BACKUP_BUCKET"
  gcloud storage cp "$db_file" "$files_file" "$BACKUP_BUCKET/"
fi

find "$BACKUP_DIR" -maxdepth 1 -type f \( -name 'db-*.dump' -o -name 'files-*.tar.gz' \) -mtime +"$KEEP_DAYS" -print -delete

echo "[$stamp] done: $(basename "$db_file") ($(du -h "$db_file" | cut -f1)), $(basename "$files_file") ($(du -h "$files_file" | cut -f1))"
