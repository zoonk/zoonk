#!/bin/bash

# Create directories if they don't exist
mkdir -p .github/copilot/llm_docs

# URL of the Phoenix test documentation
URL="https://hex2txt.fly.dev/phoenix_test/llms.txt"

echo "Fetching Phoenix test documentation from $URL..."

# Fetch the content and save it to the file
if curl -s "$URL" > .github/copilot/llm_docs/phoenix_test.md; then
    echo "✓ Successfully created .github/copilot/llm_docs/phoenix_test.md"
else
    echo "✗ Failed to fetch the documentation"
    exit 1
fi
