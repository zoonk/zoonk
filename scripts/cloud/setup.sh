#!/usr/bin/env bash
# Prepares an Ubuntu 24.04 machine, as root or a user with passwordless sudo, to run Zoonk: Node.js
# and pnpm from .tool-versions, PostgreSQL 18 from apt.postgresql.org as a service, the dependencies,
# Playwright's Chromium and the local databases. Safe to rerun; `start.sh` is the per-session part.
set -euo pipefail

# shellcheck source=scripts/cloud/start.sh
source "$(dirname "${BASH_SOURCE[0]}")/start.sh"

ORIGINAL_PATH=$PATH
NODE_MAJOR=${NODE_HOME#/opt/node}
PNPM_MAJOR=$(awk '$1 == "pnpm" { print $2 }' "$REPOSITORY/.tool-versions")
LOGS=$(mktemp -d)

# A failed step leaves the parallel ones (apt among them) to finish rather than holding dpkg's lock
# into the rerun.
on_exit() {
  local status=$?
  wait

  if [ "$status" -eq 0 ]; then
    rm -rf "$LOGS"
  else
    echo "Logs of the parallel steps are in $LOGS" >&2
  fi

  exit "$status"
}

trap on_exit EXIT

step() {
  echo "==> $*"
}

# Runs a step in the background with its output kept apart, so parallel steps don't interleave.
in_background() {
  local name=$1
  shift
  "$@" > "$LOGS/$name.log" 2>&1 &
  echo $! > "$LOGS/$name.pid"
}

finish() {
  local name=$1

  if ! wait "$(cat "$LOGS/$name.pid")"; then
    cat "$LOGS/$name.log" >&2
    echo "==> $name failed" >&2
    exit 1
  fi

  step "$name done"
}

install_node() {
  if "$NODE_HOME/bin/node" --version 2>/dev/null | grep -q "^v$NODE_MAJOR\."; then
    return
  fi

  local arch download file base="https://nodejs.org/dist/latest-v$NODE_MAJOR.x"

  case "$(uname -m)" in
    x86_64) arch=x64 ;;
    aarch64 | arm64) arch=arm64 ;;
    *)
      echo "Node.js has no Linux build for $(uname -m)." >&2
      return 1
      ;;
  esac

  step "Installing Node.js $NODE_MAJOR into $NODE_HOME"
  download=$(mktemp -d)
  curl -fsSL "$base/SHASUMS256.txt" -o "$download/SHASUMS256.txt"
  file=$(awk -v pattern="^node-v[0-9.]+-linux-$arch\\.tar\\.gz$" '$2 ~ pattern { print $2 }' "$download/SHASUMS256.txt")
  curl -fsSL "$base/$file" -o "$download/$file"
  (cd "$download" && grep " $file\$" SHASUMS256.txt | sha256sum --check --status)
  as_root rm -rf "$NODE_HOME"
  as_root mkdir -p "$NODE_HOME"
  as_root tar -xzf "$download/$file" -C "$NODE_HOME" --strip-components=1
  rm -rf "$download"
}

install_pnpm() {
  if (cd / && "$NODE_HOME/bin/pnpm" --version 2>/dev/null) | grep -q "^$PNPM_MAJOR\."; then
    return
  fi

  step "Installing pnpm $PNPM_MAJOR"
  as_root "$NODE_HOME/bin/node" "$NODE_HOME/bin/npm" install --global --no-audit --no-fund "pnpm@$PNPM_MAJOR"
}

# Shells that don't take PATH from `start.sh` still find this Node.js where /usr/local/bin comes first.
link_node() {
  local tool

  for tool in node npm npx pnpm pnpx; do
    as_root ln -sf "$NODE_HOME/bin/$tool" "/usr/local/bin/$tool"
  done
}

install_postgres() {
  if [ -x "/usr/lib/postgresql/$POSTGRES_MAJOR/bin/postgres" ]; then
    return
  fi

  local codename key=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc
  # shellcheck source=/dev/null
  codename=$(. /etc/os-release && echo "$VERSION_CODENAME")

  as_root install -d "$(dirname "$key")"
  as_root curl -fsSL -o "$key" https://apt.postgresql.org/pub/repos/apt/ACCC4CF8.asc
  echo "deb [signed-by=$key] https://apt.postgresql.org/pub/repos/apt $codename-pgdg main" |
    as_root tee /etc/apt/sources.list.d/pgdg.list > /dev/null

  as_root apt-get update -qq
  as_root env DEBIAN_FRONTEND=noninteractive apt-get install -y -qq "postgresql-$POSTGRES_MAJOR"
}

# Claude Code's image ships an idle PostgreSQL 16 on port 5432, where Zoonk's local default expects
# PostgreSQL 18's main cluster.
free_default_port() {
  local version cluster port status

  while read -r version cluster port status _; do
    if [ "$version/$cluster" = "$POSTGRES_MAJOR/main" ] || [ "$port" != 5432 ]; then
      continue
    fi

    case $status in
      online*)
        echo "PostgreSQL $version ($cluster) is running on port 5432, which PostgreSQL $POSTGRES_MAJOR needs. Stop it (pg_ctlcluster $version $cluster stop) and rerun." >&2
        return 1
        ;;
    esac

    step "Leaving PostgreSQL $version ($cluster) to start by hand, so $POSTGRES_MAJOR has port 5432"
    echo manual | as_root tee "/etc/postgresql/$version/$cluster/start.conf" > /dev/null
  done < <(pg_lsclusters --no-header)
}

configure_postgres() {
  if [ -z "$(postgres_status)" ]; then
    as_root pg_createcluster "$POSTGRES_MAJOR" main
  fi

  free_default_port

  if [ "$(pg_conftool -s "$POSTGRES_MAJOR" main show port)" != 5432 ]; then
    as_root pg_conftool "$POSTGRES_MAJOR" main set port 5432

    case "$(postgres_status)" in
      online*) as_root pg_ctlcluster "$POSTGRES_MAJOR" main restart ;;
    esac
  fi

  start_postgres

  # Debian's `postgres` role has no password; this is the one getLocalDatabaseUrl
  # (packages/db/src/local-database.ts) connects with.
  if ! PGPASSWORD=postgres psql -h localhost -U postgres -d postgres -XAtqc "SELECT 1" > /dev/null 2>&1; then
    step "Setting the postgres role's local password"
    as_root runuser -u postgres -- psql -p 5432 -Xqc "ALTER ROLE postgres PASSWORD 'postgres'"
  fi
}

install_browser() {
  cd "$REPOSITORY"
  pnpm exec playwright install --with-deps chromium
}

main() {
  if ! command -v curl > /dev/null; then
    as_root apt-get update -qq
    as_root env DEBIAN_FRONTEND=noninteractive apt-get install -y -qq curl ca-certificates
  fi

  in_background postgres install_postgres

  export PATH="$NODE_HOME/bin:$PATH"
  install_node
  install_pnpm
  link_node
  step "Installing dependencies"
  (cd "$REPOSITORY" && pnpm install --frozen-lockfile --prefer-offline)

  finish postgres
  configure_postgres

  # Playwright installs Chromium's system libraries with apt, so it waits for PostgreSQL's install.
  in_background browser install_browser
  step "Starting PostgreSQL and preparing the databases"
  start
  finish browser

  if ! env PATH="$ORIGINAL_PATH" node --version 2>/dev/null | grep -q "^v$NODE_MAJOR\."; then
    echo "Other shells may still find another Node.js first: put $NODE_HOME/bin at the front of PATH."
  fi

  step "Zoonk is ready. Run pnpm dev, or pnpm start for production builds."
}

main
