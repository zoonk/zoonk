---
name: zoonk-commit
description: Write Zoonk commit messages and PR titles or descriptions when preparing a commit or pull request.
license: MIT
metadata:
  author: zoonk
  version: "2.0.0"
---

# Commit and PR wording

Follow the repository's local-review and explicit-commit boundary. Drafting a message does not authorize a commit or push. An authorized PR uses one commit; never amend or force-push.

Use `type(scope): short message` for both commit messages and PR titles. Keep the entire title lowercase, imperative, under 72 characters, and without a final period.

| Type       | Use                                                  |
| ---------- | ---------------------------------------------------- |
| `feat`     | New behavior                                         |
| `fix`      | Bug fix                                              |
| `refactor` | Restructuring without a behavior change              |
| `chore`    | Maintenance, dependencies, configuration, or tooling |

## Scope

Use the owning app or package name: `main` for `apps/main`, `player` for `packages/player`. When several workspaces change, choose the owner of the user-facing behavior, then the main implementation, then the workspace a reviewer would inspect first. Supporting changes do not make a commit horizontal.

Use inferred scopes only when no app or package owns the work: `agents` for agent instructions and skills, `ci` for workflows, `deps` for repository-wide dependency maintenance, and `test` for tests spanning workspaces. Do not invent thematic scopes such as `auth`, `ui`, or `diagrams` when the workspace owner is clear.

Examples:

```text
fix(player): preserve progress when retrying a lesson
feat(main): add course search
refactor(core): centralize course visibility rules
chore(agents): simplify repository instructions
```

## PR description

Describe the concrete problem and resulting behavior for a reviewer who has not seen the conversation. Keep it brief; include a trigger or before/after example when useful. Rewrite the title and body around the final implementation if the scope changes. Omit conversational history and verification command lists.

For multiline bodies, use a structured tool argument or write the exact text to a temporary file and pass `gh ... --body-file <path>`.
