---
name: zoonk-commit
description: Write Zoonk commit messages and PR titles or descriptions when preparing a commit or pull request.
license: MIT
metadata:
  author: zoonk
  version: "2.0.0"
---

# Commit and PR wording

Commit each change's own files as it lands. Stage only that change's paths; never use `git add -A`, `git add .`, or `git commit -a` on a shared tree. Before committing, check the path list and diff for secrets, `.env*`, keys, logs, and temporary or scratch files. Never amend, force-push, or use `--no-verify`. Push only when asked.

Before each commit, run the change's relevant checks: typecheck, lint and format of the touched files, and affected tests, where applicable. Report the checks and results. The full [root PR verification gate](../../../AGENTS.md#pr-verification-gate) applies only before opening a PR (including a draft), marking it ready for review, or merging it. It includes the full local PR and `main` quality checks, including Main and API E2E. Include the final results in the PR's verification section.

Use `type(scope): short message` for both commit messages and PR titles. Keep the entire title lowercase, imperative, under 72 characters, and without a final period.

| Type       | Use                                                  |
| ---------- | ---------------------------------------------------- |
| `feat`     | New behavior                                         |
| `fix`      | Bug fix                                              |
| `refactor` | Restructuring without a behavior change              |
| `chore`    | Maintenance, dependencies, configuration, or tooling |

## Agent attribution

Every commit an agent writes ends, after a blank line, with a `Co-Authored-By` trailer naming the model that wrote it and its provider's noreply address. For example, from Claude Code or Codex:

```text
Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Co-Authored-By: GPT-6.1-Sol <noreply@openai.com>
```

Use the model you are running as, from your system prompt or session settings, not the harness (`Codex`, `Claude Code`) and without suffixes such as `(1M context)`. The address is `noreply@anthropic.com` for Claude models and `noreply@openai.com` for OpenAI models. Leave the Git author as configured.

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

Describe the concrete problem and resulting behavior for a reviewer who has not seen the conversation. Keep it brief; include a trigger or before/after example when useful. Rewrite the title and body around the final implementation if the scope changes. Omit conversational history.

End with a short **Verification** section that tells the reviewer what was proven and what wasn't, in plain language rather than command lists or logs:

- For user-facing changes, the [persona walkthroughs](../zoonk-persona-walkthrough/SKILL.md): which personas, which journeys including bad-day paths, what they exposed and what changed.
- The regression tests added for problems found, and the suites that matter for the change, with their results.
- What remains unverified.

For multiline bodies, use a structured tool argument or write the exact text to a temporary file and pass `gh ... --body-file <path>`.

## New commits on an open PR

After pushing commits to a PR that already exists, read its live title and body and update them in the same step when the new commits change what a reviewer would read there: the behavior or scope, what must happen before merging, open decisions, or the verification (new results, or results the change made stale). Edit the live text rather than an earlier copy, so others' edits survive. Keep the description about the PR as it now stands, not a log of commits. Leave it alone when a commit changes none of that, such as a typo or lint fix.
