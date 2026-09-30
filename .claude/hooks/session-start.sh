#!/bin/bash
# Gets a Claude Code cloud container ready to build, test and translate Zoonk like CI does:
# Node and pnpm at the repo's versions, dependencies and the Prisma client, Postgres 18 with the
# dev, test and E2E databases migrated, each app's .env, and a Chromium Playwright can launch.
# Local machines skip it. Safe to rerun: every step checks what's already there.
set -Eeuo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

LOG=/tmp/zoonk-session-start.log
: >"$LOG"
exec 3>&1 >>"$LOG" 2>&1

# The embedded-postgres build the cloud can download from npm (apt.postgresql.org is blocked).
POSTGRES_PACKAGE="@embedded-postgres/linux-x64@18.4.0-beta.17"
POSTGRES_HOME=/opt/postgresql-18
POSTGRES_DATA=/var/lib/postgresql/18/zoonk
DATABASE_URL_DEV="postgres://postgres:postgres@localhost:5432/zoonk"

warnings=()
current_step="start"

step() {
  current_step="$1"
  echo "==> $1"
}

trap 'echo "Zoonk cloud setup failed during \"$current_step\". Log: $LOG" >&3' ERR

warn() {
  echo "WARNING: $1"
  warnings+=("$1")
}

persist() {
  if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
    echo "$1" >>"$CLAUDE_ENV_FILE"
  fi
}

step "Node and pnpm"
node_major=$(sed -n 's/^nodejs //p' .tool-versions)
pnpm_version=$(sed -n 's/.*"packageManager": "pnpm@\([^"]*\)".*/\1/p' package.json)
export NVM_DIR=/opt/nvm
# nvm's functions don't run under `set -eu`, so the node binary it leaves behind is the check.
set +eu
# shellcheck disable=SC1091
source "$NVM_DIR/nvm.sh" --no-use
nvm install "$node_major"
node_path=$(nvm which "$node_major")
set -Eeu
test -x "$node_path"
node_bin=$(dirname "$node_path")
export PATH="$node_bin:$PATH"
persist "export PATH=\"$node_bin:\$PATH\""

if [ "$(pnpm --version 2>/dev/null)" != "$pnpm_version" ]; then
  npm install --global "pnpm@$pnpm_version"
fi

step "Postgres 18"
if [ ! -x "$POSTGRES_HOME/bin/postgres" ]; then
  download=$(mktemp -d)
  (cd "$download" && npm pack "$POSTGRES_PACKAGE" --silent)
  tar -xzf "$download"/*.tgz -C "$download"
  mkdir -p "$POSTGRES_HOME"
  cp -R "$download/package/native/." "$POSTGRES_HOME"
  # npm packages can't hold symlinks, so the package lists the ones its libraries need.
  node -e '
    const { symlinkSync, rmSync } = require("node:fs");
    const { basename, join } = require("node:path");
    const [home] = process.argv.slice(1);
    for (const { source, target } of require(join(home, "pg-symlinks.json"))) {
      const link = join(home, target.replace(/^native\//, ""));
      rmSync(link, { force: true });
      symlinkSync(basename(source), link);
    }
  ' "$POSTGRES_HOME"
  chmod -R a+rX "$POSTGRES_HOME"
  rm -rf "$download"
fi

id postgres >/dev/null 2>&1 || useradd --system --home-dir /var/lib/postgresql postgres

if [ ! -s "$POSTGRES_DATA/PG_VERSION" ]; then
  install -d -o postgres -g postgres "$POSTGRES_DATA"
  su postgres -s /bin/sh -c "'$POSTGRES_HOME/bin/initdb' -D '$POSTGRES_DATA' -U postgres --auth=trust -E UTF8"
fi

pg_ctl() {
  su postgres -s /bin/sh -c "'$POSTGRES_HOME/bin/pg_ctl' -D '$POSTGRES_DATA' $*"
}

if ! pg_ctl status >/dev/null; then
  pg_ctl "-o '-p 5432 -k /tmp' -l '$POSTGRES_DATA/server.log' -w start"
fi

# The embedded build has only the server, so queries go through the image's psql client.
psql() {
  command psql -h localhost -U postgres -v ON_ERROR_STOP=1 -tA "$@"
}

if [ "$(psql -c 'SHOW server_version_num')" -lt 180000 ]; then
  warn "Another Postgres older than 18 is answering on localhost:5432; stop it and start a new session."
fi

new_dev_database=false

for database in zoonk zoonk_test zoonk_e2e; do
  if [ -z "$(psql -c "SELECT 1 FROM pg_database WHERE datname = '$database'")" ]; then
    psql -c "CREATE DATABASE $database"

    if [ "$database" = zoonk ]; then
      new_dev_database=true
    fi
  fi
done

step "Environment files"
# Local development reads each app's .env; the cloud gets the examples' defaults, the local
# database and one generated auth secret. Variables set on the environment still win.
auth_secret=$(node -p 'require("node:crypto").randomBytes(32).toString("base64")')

for directory in apps/* packages/db; do
  example="$directory/.env.example"
  target="$directory/.env"

  if [ ! -f "$example" ] || [ -f "$target" ]; then
    continue
  fi

  {
    grep -E '^[A-Z0-9_]+=.+' "$example" | grep -vE '^(DATABASE_URL|DATABASE_URL_UNPOOLED|BETTER_AUTH_SECRET)=' || true
    if grep -q '^DATABASE_URL=' "$example"; then
      echo "DATABASE_URL=$DATABASE_URL_DEV"
      echo "DATABASE_URL_UNPOOLED=$DATABASE_URL_DEV"
    fi
    if grep -q '^BETTER_AUTH_SECRET=' "$example"; then
      echo "BETTER_AUTH_SECRET=$auth_secret"
    fi
  } >"$target"
  chmod 600 "$target"
done

step "Dependencies and Prisma client"
pnpm install --frozen-lockfile --prefer-offline
pnpm db:generate

step "Database migrations"
(cd packages/db && pnpm exec prisma migrate deploy) || warn "Couldn't migrate the dev database (zoonk)."

if [ "$new_dev_database" = true ]; then
  pnpm --filter @zoonk/db db:seed || warn "Couldn't seed the dev database (zoonk)."
fi

pnpm --filter @zoonk/db db:setup:test || warn "Couldn't migrate the test database (zoonk_test)."
pnpm --filter @zoonk/db db:setup:e2e || warn "Couldn't migrate the E2E database (zoonk_e2e)."

step "Playwright browser"
# The cloud image ships one Chromium in PLAYWRIGHT_BROWSERS_PATH. When Playwright's pinned build
# can't be downloaded (cdn.playwright.dev blocked), E2E launches that Chromium instead.
if ! (cd packages/e2e && env -u PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD pnpm exec playwright install --only-shell chromium); then
  if [ -x "${PLAYWRIGHT_BROWSERS_PATH:-/opt/pw-browsers}/chromium" ]; then
    persist "export PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=\"${PLAYWRIGHT_BROWSERS_PATH:-/opt/pw-browsers}/chromium\""
  else
    warn "No Chromium for Playwright: allow cdn.playwright.dev in the environment's network access."
  fi
fi

exec 1>&3

if [ ${#warnings[@]} -eq 0 ]; then
  echo "Zoonk cloud setup is ready: Node $(node --version), pnpm $pnpm_version, Postgres 18 on localhost:5432 (zoonk, zoonk_test, zoonk_e2e). Log: $LOG"
else
  echo "Zoonk cloud setup finished with warnings (log: $LOG):"
  printf -- '- %s\n' "${warnings[@]}"
fi
