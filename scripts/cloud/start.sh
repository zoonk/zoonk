#!/usr/bin/env bash
# Run at the start of each session on a machine that `setup.sh` prepared: cloud snapshots and
# restarts keep files but not processes. Starts PostgreSQL, then brings the dependencies and the
# local databases up to the checkout's commit.
set -euo pipefail

# Migrations call uuidv7(), which PostgreSQL added in 18.
POSTGRES_MAJOR=18
REPOSITORY=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
NODE_HOME=/opt/node$(awk '$1 == "nodejs" { print $2 }' "$REPOSITORY/.tool-versions")

as_root() {
  if [ "$(id -u)" -eq 0 ]; then "$@"; else sudo "$@"; fi
}

postgres_status() {
  { pg_lsclusters --no-header "$POSTGRES_MAJOR" main 2>/dev/null || true; } | awk '{ print $4 }'
}

start_postgres() {
  case "$(postgres_status)" in
    online*) ;;
    *) as_root pg_ctlcluster "$POSTGRES_MAJOR" main start ;;
  esac
}

start() {
  export PATH="$NODE_HOME/bin:$PATH"

  # Claude Code's cloud image puts its own Node.js on PATH; a SessionStart hook hands later commands
  # another PATH through this file.
  if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
    echo "export PATH=\"$NODE_HOME/bin:\$PATH\"" >> "$CLAUDE_ENV_FILE"
  fi

  start_postgres
  cd "$REPOSITORY"
  pnpm install --frozen-lockfile --prefer-offline
  pnpm db:setup
}

if [ "${BASH_SOURCE[0]}" = "$0" ]; then
  start
fi
