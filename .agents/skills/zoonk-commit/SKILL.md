---
name: zoonk-commit
description: Write Zoonk commit messages and PR titles and descriptions, and choose the before-and-after numbers, screenshots and videos a PR shows. Use when preparing a commit or a pull request.
license: MIT
metadata:
  author: zoonk
  version: "3.0.0"
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

## PR description

Describe the concrete problem and resulting behavior for a reviewer who has not seen the conversation. Keep it brief; include a trigger or before/after example when useful. Rewrite the title and body around the final implementation if the scope changes. Omit conversational history.

For each piece the PR adds or redraws (a component, a part of a screen, a rule), name where the product already does the same thing, or write "none found" with what you searched ([find the piece](../zoonk-design/SKILL.md#find-the-piece-before-you-build-one)). Reviewers compare the two.

List under **Exceptions** every departure from a rule about looks (the screen, the rule, what shipped instead and why) and every exception an agent asked for with the answer it got, so the user can accept or overrule each one ([when a rule looks wrong](../../guides/exceptions.md)).

End with a short **Verification** section that tells the reviewer what was proven and what wasn't, in plain language rather than command lists or logs:

- For user-facing changes, the [persona walkthroughs](../zoonk-persona-walkthrough/SKILL.md): which personas, which journeys including bad-day paths, what they exposed and what changed.
- The regression tests added for problems found, and the suites that matter for the change, with their results.
- What remains unverified.

For multiline bodies, use a structured tool argument or write the exact text to a temporary file and pass `gh ... --body-file <path>`.

## Show the change

A reviewer sees what the change did without running it, from evidence of both sides measured the same way: numbers for something faster or lighter, screenshots for anything a learner sees, a video for something that moves or takes several steps, a preview link for a blog post. Capture the before side first, before you edit.

- [Show the change](references/show-the-change.md): what each kind of change shows, how to report numbers, and how few pictures make it clear.
- [Capturing screens](references/capture.md): `pnpm pr:capture`, steps for a screen behind taps, videos, and the native apps.
- [The picture gate](references/picture-gate.md): what `pnpm pr:media check` holds every picture to before the body goes up.

## New commits on an open PR

After pushing commits to a PR that already exists, read its live title and body and update them in the same step when the new commits change what a reviewer would read there: the behavior or scope, what must happen before merging, open decisions, the verification (new results, or results the change made stale), or what the before and after show (capture the after side again). Edit the live text rather than an earlier copy, so others' edits survive. Keep the description about the PR as it now stands, not a log of commits. Leave it alone when a commit changes none of that, such as a typo or lint fix.
