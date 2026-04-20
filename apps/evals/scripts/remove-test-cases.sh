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

ROOT="apps/evals/eval-results"
OUTPUTS_DIR="$ROOT/outputs/$TASK_ID"
RESULTS_DIR="$ROOT/results/$TASK_ID"
BATTLES_DIR="$ROOT/battles/$TASK_ID"

# Build jq conditions for filtering arrays. `outputs` uses `.testCaseId`,
# `results` uses `.testCase.id`.
outputs_cond=""
results_cond=""
for id in "${IDS[@]}"; do
  outputs_cond+=" and .testCaseId != \"$id\""
  results_cond+=" and .testCase.id != \"$id\""
done
outputs_cond="${outputs_cond# and }"
results_cond="${results_cond# and }"

filter_array() {
  local file="$1" key="$2" cond="$3"
  local tmp
  tmp="$(mktemp)"
  jq "if (.${key} | type) == \"array\" then .${key} |= map(select(${cond})) else . end" "$file" > "$tmp" && mv "$tmp" "$file"
}

if [[ -d "$OUTPUTS_DIR" ]]; then
  find "$OUTPUTS_DIR" -type f -name '*.json' -print0 |
  while IFS= read -r -d '' f; do
    filter_array "$f" "outputs" "$outputs_cond"
  done
fi

if [[ -d "$RESULTS_DIR" ]]; then
  find "$RESULTS_DIR" -type f -name '*.json' -print0 |
  while IFS= read -r -d '' f; do
    filter_array "$f" "results" "$results_cond"
  done
fi

# Battles are stored one file per test case, named `<testCaseId>.json`.
if [[ -d "$BATTLES_DIR" ]]; then
  for id in "${IDS[@]}"; do
    rm -f "$BATTLES_DIR/$id.json"
  done
fi
