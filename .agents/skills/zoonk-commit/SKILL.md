---
name: zoonk-commit
description: Use when writing a Zoonk commit message, or a pull request's title and description and the before-and-after numbers, screenshots and videos it shows.
license: MIT
metadata:
  author: zoonk
  version: "4.0.0"
---

# Commit and PR wording

Commit each change's own files as it lands. Stage only that change's paths; never use `git add -A`, `git add .`, or `git commit -a` on a shared tree. Before committing, check the path list and diff for secrets, `.env*`, keys, logs, and temporary or scratch files. Never amend, force-push, or use `--no-verify`. Push when you open or update the task's pull request ([zoonk-pull-request](../zoonk-pull-request/SKILL.md)), and otherwise only when asked.

Before each commit, run the change's checks ([checks for a change](../../guides/checks.md)). Report them and their results, and include the final ones in the PR's verification section.

Use `type(scope): short message` for both commit messages and PR titles. Keep the entire title lowercase, imperative, under 72 characters, and without a final period. Commit and merge messages describe the change for someone who never saw how it was made, never the process that produced it (agent names or task codes).

| Type       | Use                                                  |
| ---------- | ---------------------------------------------------- |
| `feat`     | New behavior                                         |
| `fix`      | Bug fix                                              |
| `refactor` | Restructuring without a behavior change              |
| `test`     | Tests or test setup only                             |
| `chore`    | Maintenance, dependencies, configuration, or tooling |

Pick the type from what the commit changes. A commit that touches only tests or their setup (fixtures, mocks, helpers, test config) is `test`, even when it repairs a failing or flaky test; a product fix that adds its regression test stays `fix`.

## Agent attribution

Every commit an agent writes ends, after a blank line, with a `Co-Authored-By` trailer naming the model that wrote it and its provider's noreply address. For example, from Claude Code or Codex:

```text
Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Co-Authored-By: GPT-6.1-Sol <noreply@openai.com>
```

Use the model you are running as, from your system prompt or session settings, not the harness (`Codex`, `Claude Code`) and without suffixes such as `(1M context)`. The address is `noreply@anthropic.com` for Claude models and `noreply@openai.com` for OpenAI models. Leave the Git author as configured.

## Scope

Use the owning app or package name: `main` for `apps/main`, `player` for `packages/player`. When several workspaces change, choose the owner of the user-facing behavior, then the main implementation, then the workspace a reviewer would inspect first. Supporting changes do not make a commit horizontal.

Use inferred scopes only when no app or package owns the work: `agents` for agent instructions and skills, `ci` for workflows, and `deps` for repository-wide dependency maintenance. Do not invent thematic scopes such as `auth`, `ui`, or `diagrams` when the workspace owner is clear.

Examples:

```text
fix(player): preserve progress when retrying a lesson
feat(main): add course search
refactor(core): centralize course visibility rules
test(api): stabilize the sign-in e2e
chore(agents): simplify repository instructions
```

## Pull requests

A PR's title follows the rules above. Its body, the before and after it shows, and its updates after new commits are in [the PR description](references/pr-description.md).
