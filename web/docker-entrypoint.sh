#!/bin/sh
# Entry point of the web containers.
#
# docker-compose.yml bind-mounts the source over /app and keeps
# /app/node_modules in a named volume. That volume is filled from the image the
# first time only, so after someone changes package-lock.json it would be stale.
# This script compares the lock file with the stamp left by the last install and
# reinstalls when they differ. With an unchanged lock file nothing is
# downloaded, so the containers start without internet.
set -eu

LOCK_FILE="/app/package-lock.json"
STAMP_FILE="/app/node_modules/.package-lock.sha256"

if [ ! -f "$LOCK_FILE" ]; then
  echo "docker-entrypoint: $LOCK_FILE is missing; is web/ mounted on /app?" >&2
  exit 1
fi

current_hash="$(sha256sum "$LOCK_FILE" | cut -d ' ' -f 1)"
installed_hash="$(cat "$STAMP_FILE" 2>/dev/null || true)"

if [ "$current_hash" != "$installed_hash" ]; then
  echo "docker-entrypoint: package-lock.json changed, running npm ci (needs internet)..." >&2
  npm ci --no-audit --no-fund
  echo "$current_hash" > "$STAMP_FILE"
fi

exec "$@"
