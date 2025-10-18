#!/usr/bin/env bash
# remove-test-cases.sh — remove specific test cases from all task results
# Usage: pnpm evals:remove taskId id1 id2 ...

set -euo pipefail

TASK_ID="${1:-}"
IDS=("${@:2}")

if [[ -z "$TASK_ID" || "${#IDS[@]}" -eq 0 ]]; then
  echo "Usage: pnpm evals:remove taskId id1 [id2 ...]"
  exit 1
fi

DIR="apps/evals/eval-results/$TASK_ID"

cond=""
for id in "${IDS[@]}"; do
  cond+=" and .testCase.id != \"$id\""
done
cond="${cond# and }"

find "$DIR" -type f -name '*.json' -print0 |
while IFS= read -r -d '' f; do
  tmp="$(mktemp)"
  jq "
    if (.results | type) == \"array\" then
      .results |= map(select($cond))
    else
      .
    end
  " "$f" > "$tmp" && mv "$tmp" "$f"
done
