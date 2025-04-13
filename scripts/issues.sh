#!/bin/bash

# This script exports GitHub issues and discussions for the Zoonk project.
# Usage: sh ./scripts/issues.sh [--milestone <milestone>]
# Example: sh ./scripts/issues.sh --milestone "v0.1"

# Default milestone
MILESTONE="v0.1"

# Parse arguments
while [[ "$#" -gt 0 ]]; do
  case $1 in
    --milestone) MILESTONE="$2"; shift ;;
    *) echo "Unknown parameter passed: $1"; exit 1 ;;
  esac
  shift
done

# Export GitHub Issues for the specified milestone
(
  echo "# GitHub Issues"
  echo
  echo "These are the issues for the \`$MILESTONE\` milestone. We're including the issue title, number, and body. Some issues don't have a body, though."
  echo "Some issues are used just to group sub-issues, a new feature added by GitHub recently. So, even though they may look empty, they aren't."
  echo "They show up empty here because GitHub doesn't show them when exporting issues from the CLI."
  echo
  gh issue list --repo zoonk/zoonk --milestone "$MILESTONE" --limit 1000 --json number,title,body \
    --jq '.[] | "#\(.number): \(.title)\n\n\(.body)\n\n---\n"'
) > .github/copilot/llm_docs/milestone_issues.txt

# Export GitHub Discussions from "Ideas" category
(
  echo "# Zoonk Ideas"
  echo
  echo "This is a list of all ideas posted on GitHub Discussions."
  echo
  gh api \
    -H "Accept: application/vnd.github.v3+json" \
    /repos/zoonk/zoonk/discussions \
    --paginate | jq -r '.[] | select(.category.name == "Ideas") | "### \(.title)\n\n\(.body)\n\n---"'
) > .github/copilot/llm_docs/ideas.txt
