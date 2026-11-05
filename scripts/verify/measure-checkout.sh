#!/usr/bin/env bash
# For the Measure pages workflow: measure-checkout.sh <checkout> <report folder> [verify:pages flags…],
# with EMAIL, FLAGS and PATHS from its inputs.
set -e

checkout=$1
out=$2
shift 2

cd "$checkout"
pnpm install --frozen-lockfile --prefer-offline
pnpm exec playwright install --with-deps chromium
# db:setup leaves the databases to CI when CI is set; here it makes and seeds them.
env -u CI pnpm db:setup
mkdir -p "$out"

# In CI, Turbo holds a task's output until it ends, and a server never ends.
TURBO_LOG_ORDER=stream ZOONK_QUERY_LOG="$out/queries.jsonl" \
  setsid pnpm start main > "$out/start.log" 2>&1 &
server=$!
# pnpm start outlives a TERM, and its services stop by themselves once it's gone.
trap 'kill -KILL -- -"$server" 2> /dev/null || true; wait "$server" || true' EXIT

url=$(node -e "import('./scripts/dev/config.mts').then((config) => console.log(config.getServiceUrl({ currentDirectory: process.cwd(), serviceName: 'main' })))")
deadline=$((SECONDS + 1200))

# Next prints that it's ready before its port answers.
until curl --silent --fail --max-time 10 --output /dev/null "$url"; do
  if ! kill -0 "$server" 2> /dev/null || [ "$SECONDS" -gt "$deadline" ]; then
    cat "$out/start.log"
    exit 1
  fi

  sleep 2
done

# A failing check exits 1 after writing the report, which the workflow reads.
# shellcheck disable=SC2086 # FLAGS and PATHS are lists.
pnpm verify:pages ${EMAIL:+--email "$EMAIL"} --queries "$out/queries.jsonl" --out "$out" \
  "$@" $FLAGS $PATHS || true
