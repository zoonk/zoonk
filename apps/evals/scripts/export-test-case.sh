#!/usr/bin/env bash
# export-test-case.sh — export answers from all models for a specific test case
# Usage: pnpm evals:export taskId testCaseId

set -euo pipefail

TASK_ID="${1:-}"
TEST_CASE_ID="${2:-}"

if [[ -z "$TASK_ID" || -z "$TEST_CASE_ID" ]]; then
  echo "Usage: pnpm evals:export taskId testCaseId"
  echo "Example: pnpm evals:export course-chapters en-machine-learning-1"
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

# Create a temporary file to collect all models
TEMP_FILE=$(mktemp)
MODEL_INDEX=1

# Process each JSON file in the directory and collect results
find "$DIR" -type f -name '*.json' | sort | while IFS= read -r file; do
  # Extract the test case with matching ID
  OUTPUT=$(jq --arg id "$TEST_CASE_ID" '
    .results[] | select(.testCase.id == $id) | .output
  ' "$file" 2>/dev/null || echo "")
  
  # Only add if output was found and is not empty
  if [[ -n "$OUTPUT" && "$OUTPUT" != "null" ]]; then
    # Write model entry as a line in temp file
    echo "$OUTPUT" | jq -c --argjson modelId "$MODEL_INDEX" '{modelId: $modelId, output: .}' >> "$TEMP_FILE"
    MODEL_INDEX=$((MODEL_INDEX + 1))
  fi
done

# Check if we found any results
if [[ ! -s "$TEMP_FILE" ]]; then
  echo "Error: No results found for test case '$TEST_CASE_ID' in task '$TASK_ID'"
  rm "$TEMP_FILE"
  exit 1
fi

# Combine all entries into final JSON using jq slurp
jq -s \
  --arg taskId "$TASK_ID" \
  --arg testCaseId "$TEST_CASE_ID" \
  '{taskId: $taskId, testCaseId: $testCaseId, models: .}' \
  "$TEMP_FILE" > "$OUTPUT_FILE"

# Clean up temp file
rm "$TEMP_FILE"

MODEL_COUNT=$(jq '.models | length' "$OUTPUT_FILE")

echo "✓ Exported answers from all models to $OUTPUT_FILE"
echo "  Found $MODEL_COUNT model responses"
