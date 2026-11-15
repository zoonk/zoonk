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

When agents asked for exceptions to a rule during the task, list each one and the answer it got under **Exceptions**, so the user can accept or overrule it ([exceptions](../../guides/orchestration.md#exceptions)).

End with a short **Verification** section that tells the reviewer what was proven and what wasn't, in plain language rather than command lists or logs:

- For user-facing changes, the [persona walkthroughs](../zoonk-persona-walkthrough/SKILL.md): which personas, which journeys including bad-day paths, what they exposed and what changed.
- The regression tests added for problems found, and the suites that matter for the change, with their results.
- What remains unverified.

For multiline bodies, use a structured tool argument or write the exact text to a temporary file and pass `gh ... --body-file <path>`.

## Show the change

A reviewer sees what the change did without running it, from evidence of both sides measured the same way. Capture the before side first, before you edit; a reviewer can't check a before you describe from memory.

| The change                                                                                                    | The PR shows                                                                              |
| ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Makes something faster, lighter or cheaper                                                                    | Each number before → after, with the difference and how it was measured                   |
| Changes what a learner sees: layout, copy, color, a state, a new screen                                       | Screenshots before and after of the screens that show the change, on a phone and a laptop |
| Changes something that moves or takes several steps: a flow, a transition, a wait, a loading state, a gesture | Those screenshots, and a video of each side doing the same steps                          |
| Adds or edits a blog post                                                                                     | A link to the post on the PR's Vercel preview, instead of screenshots                     |

- **Numbers:** each metric with before → after and the difference (`LCP, phone, throttled: 2.4 s → 1.1 s (−54%)`), what was measured (page or command, build, screen, throttling) and how many runs. Measure both sides back to back on the same machine and settings; on a busy machine, compare the numbers noise barely moves (main-thread work, counts, bytes). For pages, `verify:pages --baseline` prints the table ([measuring pages](../verify/references/pages.md)). Report a number that didn't move or got worse too. "Faster" without numbers isn't evidence.
- **Any visual change gets screenshots:** what decides it is whether a learner would see a difference, not how big the change is. They let a reviewer see what changed from the PR alone, so a PR that changes what a learner sees is not ready to open without them.
- **A new screen** has only an after side and **a removed one** only a before; say so in its panel.
- **A blog post** needs no screenshots: its preview is the page readers will get, on any screen. Once the PR is open, start the preview ([how](../zoonk-pull-request/SKILL.md#4-hand-back)) and link the post on it in the body; after a push that changes the post, preview again and update the link.

### Keep it short and clear

A reviewer looks at every picture, and a long page of them hides the one that matters.

- **Show the few screens that make the change clear,** usually one to three: the screen the change is about, plus another size, scheme or state only where the change looks different there. A change that reaches many screens, such as a redesign, shows a representative few, and the verification section says what else you checked.
- **Each screen gets a collapsed panel,** and its summary says what changed there, so a reviewer can scan the summaries without opening any: `<summary>Today: the time readout sits at the title's end</summary>`. Put the screen that shows the change best first; its panel starts open. `media.md` is laid out this way; lay out hand-made media (the native apps, a sheet of several screens) the same way.
- **Compare each pair before you attach it.** `pr:capture` prints how much of each shot changed and the box around it, and leaves out pairs where nothing changed. When you can't spot the difference at a glance, a reviewer can't either: say in the summary where to look, and when it's a small part of the screen, lead with a shot of just that part (`shot(name, { clip })`). Drop a pair whose change doesn't show.

### Screenshots and videos

`pnpm pr:capture` captures Main (`--app api` or `--app admin` another app) the same way on both sides records each picture's bytes, build and screen in `capture.json` beside it, and measures each screen it shoots into the side's `alignment.json`. Run it on `pnpm start` serving this checkout, after you commit: `pnpm dev` adds its own overlay and loading states learners never see, and an after picture from it, from another checkout's server or from uncommitted changes can't pass the [picture gate](#every-picture-is-captured-current-and-read).

```sh
pnpm pr:capture before /today /plan --email <learner>@zoonk.test   # before you edit
pnpm pr:capture after /today /plan --email <learner>@zoonk.test    # after the change
```

Each run shoots every path on a phone and a laptop in light mode (`--viewports`; `--schemes light,dark` when colors change), replaces `tmp/pr-media/<side>/` and, once the gate passes, rewrites `tmp/pr-media/media.md`: a collapsed panel per screen pairing each screenshot with its other side, then a panel per video. For a screen behind taps, or a video (`--video`), write the steps once and pass them to both runs, such as `pnpm pr:capture after --steps tmp/pr-media/steps.mts --video --viewports phone`:

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
- For the Apple app, take each screenshot with its [layout capture](../verify/references/apple.md#layout-capture), which records it as `pr:capture` does. For Android, take them from a JVM render with its [layout capture](../verify/references/android.md#layout-capture) and adopt them (below); a sheet or dialog shown over its page comes from the emulator, taken by `pnpm pr:media device` (below). Record videos with `agent-device record`, `xcrun simctl io <device> recordVideo` or `adb shell screenrecord`. Put them in the same panels.

[zoonk-pull-request](../zoonk-pull-request/SKILL.md) uploads them when it opens the PR.

### Every picture is captured, current and read

The PR's pictures pass `pnpm pr:media check` before the body goes up ([when](../zoonk-pull-request/SKILL.md#1-open-it)). It holds every picture to its capture record, so a reviewer sees the build the PR ships, read by someone who didn't make it:

- **Captured.** Each picture in the body has a record with its bytes: from `pnpm pr:capture`, an Apple layout capture, an adopted Android render, or a registration. Adopt Android renders with `pnpm pr:media adopt <before|after> <render.json>...`, each picture's layout file from a render with `-Pzoonk.shots`. Register an existing before picture (taken on the base, or kept from an earlier capture) with `pnpm pr:media before --platform <web|android|apple> --source "<where it came from>" <files>`; it passes, since an old before is expected. It refuses an after. A picture only a booted simulator or emulator can show is taken by `pnpm pr:media device --platform <android|apple> --device <udid|serial> --name <shot>`; nothing measures its layout, so it goes in the body only under the level-2 heading `## On a device (layout not measured)`, as a plain image line with the line the command prints as its visible caption (the device, and the build's commit, or for an emulator "build not verified, installed <time>"), and the check fails it anywhere else. Any other native after picture with no capture behind it is registered with `pnpm pr:media pending --platform <android|apple> <files>`. It fails the check as pending, and the handoff names it as unverified.
- **Current.** An after picture fails when its build is unknown, has uncommitted changes, or is older than a later commit to its app or `packages/`, on every platform: an Android render's and an Apple Debug build's stamps count the same way as the web's build. Commit, rebuild and capture again. After each push, capture again: a picture whose pixels didn't change keeps its read, so only changed pictures need a new one.
- **Read.** `pnpm pr:media tiles` cuts each after picture into original-size tiles and writes `tmp/pr-media/read/READ.md`, the reader's sheet. Give it to an agent that built none of the screens, never the one that made them, on a design model ([pick the model](../../guides/orchestration.md#pick-the-model)). It looks at each whole screen, then every tile, and writes down what's off before it looks at any numbers (edges that don't line up, uneven gaps, empty room, text cut off or crowded, two filled buttons on one surface, words someone new wouldn't know), then reconciles that with the measurements. It also lists a page's questions together, and each wait or notice state's words from every platform side by side. Record the read with `pnpm pr:media read --by "<who read>" --findings <file.json>`, a JSON array of `{ "file", "text" }` with each file as READ.md lists it, or without `--findings` for a clean read.
- **Resolved.** A finding stays open until `pnpm pr:media resolve <id> --fixed <commit>` and a picture retaken from that commit, or `--exception "<who granted it>"` for an exception the user granted.
- **Measured.** The check judges each folder's captures itself, on every platform, and fails an after side on a failing relationship, a part it couldn't measure, or a missing scenario. A before side isn't judged: it shows the fault the change fixes. The summary's `layout measured with nothing declared on N screens` names screens with no declared piece, and `layout not measured for N captures` names after captures with no alignment report: the read alone checked their layout.

Right after `pnpm pr:capture after`, the check fails on "no read" and `media.md` isn't written: that's expected. It appears once the read is recorded and the check passes. The check can't see a hand-edited `capture.json` (a hand-written device record only puts a picture under the device heading, where a reader sees nothing measured it), a picture uploaded outside these commands, whether a before came from where its `--source` says, or a picture that measures right and looks wrong, and CI doesn't run it; the read is what catches the last.

## New commits on an open PR

After pushing commits to a PR that already exists, read its live title and body and update them in the same step when the new commits change what a reviewer would read there: the behavior or scope, what must happen before merging, open decisions, the verification (new results, or results the change made stale), or what the before and after show (capture the after side again). Edit the live text rather than an earlier copy, so others' edits survive. Keep the description about the PR as it now stands, not a log of commits. Leave it alone when a commit changes none of that, such as a typo or lint fix.
