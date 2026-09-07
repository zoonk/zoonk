---
name: zoonk-github-issues
description: Create or update problem-focused Zoonk GitHub issues and their requested metadata or relationships.
license: MIT
metadata:
  author: zoonk
  version: "2.0.0"
---

# GitHub issues

Record the user's problem and desired outcome in the requested repository. A request to create or update an issue authorizes that action; a request to draft or plan does not authorize publication. Inspect the target issue before updating it and preserve unrelated content and metadata.

## Issue content

An ordinary issue usually needs only:

```markdown
## Problem

Describe the current experience, who it affects, and why it matters.

## Desired outcome

Describe how that experience should improve.
```

Add observed versus expected behavior and reproduction evidence for a bug when available. A motivating example may illustrate a broader problem; do not silently narrow the scope to that example or speculate about an unverified fix.

Do not add architecture, file lists, scope/non-goals, implementation steps, acceptance checklists, tests, commands, or delivery phases by default. Include technical detail when the user asks for a specification or implementation task. Keep parent epics focused on the overall problem.

## Publication and metadata

- Prefer a structured tool argument or `gh issue create --title "..." --body-file <path>` for multiline text. Verify the destination repository from current context or GitHub configuration.
- Inspect existing labels when assigning them. Reuse the current app/feature grouping and colors; do not infer a new label from an obsolete app name or create a taxonomy as a side effect of an ordinary issue request.
- Use GitHub's native fields for issue type, parent/sub-issues, and blocked-by dependencies. Avoid duplicating metadata in the body.
- Verify issue numbers before cross-referencing them. Local spec numbers and filenames are not GitHub issue numbers; keep a mapping when publishing a breakdown.
- Make the issue self-contained. Temporary local paths are not usable context for a GitHub reader.
- Confirm the created or updated issue and return its link. If a batch partly fails, report completed work and inspect live state before retrying.

For an explicit request to split work into multiple issues, use [zoonk-issue-planning](../zoonk-issue-planning/SKILL.md). For issue types, dependencies, or sub-issue API operations, load [relationship recipes](references/relationships.md). A single ordinary issue does not require either workflow.
