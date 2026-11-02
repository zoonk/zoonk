#!/usr/bin/env bash

set -euo pipefail

TASK_ID="${1:-}"
TEST_CASE_ID="${2:-}"

if [[ -z "$TASK_ID" || -z "$TEST_CASE_ID" ]]; then
  echo "Usage: pnpm evals:export taskId testCaseId"
  echo "Example: pnpm evals:export course-intent topic-biology"
  exit 1
fi

DIR="apps/evals/eval-results/$TASK_ID"
OUTPUT_DIR="apps/evals/eval-results/$TASK_ID/comparisons"
OUTPUT_FILE="$OUTPUT_DIR/${TEST_CASE_ID}.json"

if [[ ! -d "$DIR" ]]; then
  echo "Task directory $DIR does not exist."
  exit 1
fi

if [[ ! -d "$OUTPUT_DIR" ]]; then
  echo "Directory $OUTPUT_DIR does not exist. Creating it..."
  mkdir -p "$OUTPUT_DIR"
fi

TEMP_FILE=$(mktemp)
MODEL_INDEX=1

find "$DIR" -type f -name '*.json' | sort | while IFS= read -r file; do
  OUTPUT=$(jq --arg id "$TEST_CASE_ID" '
    .results[] | select(.testCase.id == $id) | .output
  ' "$file" 2>/dev/null || echo "")
  
  if [[ -n "$OUTPUT" && "$OUTPUT" != "null" ]]; then
    echo "$OUTPUT" | jq -c --argjson modelId "$MODEL_INDEX" '{modelId: $modelId, output: .}' >> "$TEMP_FILE"
    MODEL_INDEX=$((MODEL_INDEX + 1))
  fi
done

if [[ ! -s "$TEMP_FILE" ]]; then
  echo "Error: No results found for test case '$TEST_CASE_ID' in task '$TASK_ID'"
  rm "$TEMP_FILE"
  exit 1
fi

jq -s \
  --arg taskId "$TASK_ID" \
  --arg testCaseId "$TEST_CASE_ID" \
  '{taskId: $taskId, testCaseId: $testCaseId, models: .}' \
  "$TEMP_FILE" > "$OUTPUT_FILE"

rm "$TEMP_FILE"

MODEL_COUNT=$(jq '.models | length' "$OUTPUT_FILE")

echo "✓ Exported answers from all models to $OUTPUT_FILE"
echo "  Found $MODEL_COUNT model responses"
