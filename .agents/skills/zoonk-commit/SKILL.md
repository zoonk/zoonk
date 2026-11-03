---
name: zoonk-commit
description: Write Zoonk commit messages and PR titles or descriptions, including the before-and-after numbers, screenshots and videos a PR shows, when preparing a commit or pull request.
license: MIT
metadata:
  author: zoonk
  version: "2.0.0"
---

# Commit and PR wording

Commit each change's own files as it lands. Stage only that change's paths; never use `git add -A`, `git add .`, or `git commit -a` on a shared tree. Before committing, check the path list and diff for secrets, `.env*`, keys, logs, and temporary or scratch files. Never amend, force-push, or use `--no-verify`. Push when you open or update the task's pull request ([zoonk-pull-request](../zoonk-pull-request/SKILL.md)), and otherwise only when asked.

Before each commit, run the change's relevant checks: format and lint the touched files, typecheck their packages, and run the affected tests, where applicable. Report the checks and results, and include the final ones in the PR's verification section; CI runs the full suites on the PR ([root PR verification gate](../../../AGENTS.md#pr-verification-gate)).

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

## Show the change

A reviewer sees what the change did without running it, from evidence of both sides measured the same way. Capture the before side first, before you edit; a reviewer can't check a before you describe from memory.

| The change                                                                                                    | The PR shows                                                                    |
| ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Makes something faster, lighter or cheaper                                                                    | Each number before → after, with the difference and how it was measured         |
| Changes what a learner sees: layout, copy, color, a state, a new screen                                       | Screenshots before and after of each screen it changes, on a phone and a laptop |
| Changes something that moves or takes several steps: a flow, a transition, a wait, a loading state, a gesture | Those screenshots, and a video of each side doing the same steps                |

- **Numbers:** each metric with before → after and the difference (`LCP, phone, throttled: 2.4 s → 1.1 s (−54%)`), what was measured (page or command, build, screen, throttling) and how many runs. Measure both sides back to back on the same machine and settings; on a busy machine, compare the numbers noise barely moves (main-thread work, counts, bytes). For pages, `verify:pages --baseline` prints the table ([measuring pages](../verify/references/pages.md)). Report a number that didn't move or got worse too. "Faster" without numbers isn't evidence.
- **A new screen** has only an after side and **a removed one** only a before; say so under the table.

### Screenshots and videos

`pnpm pr:capture` captures Main the same way on both sides and writes the PR's before-and-after section. Run it on `pnpm start`: `pnpm dev` adds its own overlay and loading states learners never see.

```sh
pnpm pr:capture before /today /plan --email <learner>@zoonk.test   # before you edit
pnpm pr:capture after /today /plan --email <learner>@zoonk.test    # after the change
```

Each run shoots every path on a phone and a laptop in light mode (`--viewports`; `--schemes light,dark` when colors change), replaces `tmp/pr-media/<side>/` and rewrites `tmp/pr-media/media.md`: a table pairing each screenshot with its other side, then each side's video. For a screen behind taps, or a video (`--video`), write the steps once and pass them to both runs, such as `pnpm pr:capture after --steps tmp/pr-media/steps.mts --video --viewports phone`:

```ts
// tmp/pr-media/steps.mts
export default async function steps({ page, shot }) {
  await page.goto("/today");
  await shot("today");
  await page.getByRole("button", { name: "Start" }).click();
  await shot("first question");
}
```

- `shot(name, options)` waits until the page stops changing, or shoots at once with `settle: false` (a loading state), and takes Playwright's screenshot options (`fullPage`, `mask`). On a phone, a full-page shot ends touch emulation until the next load, so take it after the taps.
- The steps run on each screen and scheme in turn. When they change what the learner has (an answer, a finished lesson), capture one screen and give each side its own learner (`pnpm dev:persona`).
- If you already changed the code, capture the before side on the base the way [measuring pages](../verify/references/pages.md) measures a `--baseline`.
- Look at every shot and video before you attach it: a path that fails stops the run, but a step that lands on the wrong screen still makes a picture of it.
- Attached files are public, like the repository: show seeded and `dev:persona` learners only, never a real learner's data or a secret.
- For the Apple or Android app, take the same shots and recordings in the simulator or emulator (`agent-device screenshot` and `record`, or `xcrun simctl io <device> screenshot` and `recordVideo`, `adb exec-out screencap -p` and `adb shell screenrecord`), and link them in the body the same way.

[zoonk-pull-request](../zoonk-pull-request/SKILL.md) uploads them when it opens the PR.

## New commits on an open PR

After pushing commits to a PR that already exists, read its live title and body and update them in the same step when the new commits change what a reviewer would read there: the behavior or scope, what must happen before merging, open decisions, the verification (new results, or results the change made stale), or what the before and after show (capture the after side again). Edit the live text rather than an earlier copy, so others' edits survive. Keep the description about the PR as it now stands, not a log of commits. Leave it alone when a commit changes none of that, such as a typo or lint fix.
