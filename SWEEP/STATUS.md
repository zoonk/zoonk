# PR #2780 status

The handoff for whoever continues this PR, on any machine. Read this, `SWEEP/DECISIONS.md` and the PR description; nothing else is needed. This folder is removed in the commit before the final head.

## Where it stands

- **Head:** see `git log -1 origin/cw/ux-clarity-audit`. Each landing is a `Merge FX-<LANE>: …` commit.
- **Landing now (FS-D47):** the six lane branches land one after another: NX, AG2, AP, CALLS, AGF, then W4's two integration commits if the others don't already cover them. Each landed branch is deleted from origin.
- **Still to do, in order:**
  1. The words pass (Claude): revise the English the second sweep wired as stubs (`SWEEP/WORDS.md`) and re-translate what changes through Eloqnt. It also settles FS-D43's unit label ("in days" reads right; "in times" doesn't).
  2. Web triage of the blind reads (web-01 to web-29), then web fix slices.
  3. Retake the changed screens and read them blind; `pnpm verify:scenarios`; Apple tests on a fresh simulator; the automated review on the final head; a preview; then the final head.

## How to land a slice

1. Branch from `origin/cw/ux-clarity-audit`, commit each working step, and push your branch after every commit (plain push, never force or amend).
2. Fill the locales of any new English through `pnpm --filter <app> i18n`.
3. In a clean checkout, merge the slice onto the current head (`git merge --no-ff`, message `Merge FX-<LANE>: <what a learner gets>`).
4. Run the checks for what it touches (`.agents/guides/development.md#commands`), every exit code read as 0:
   - web: format, lint, typecheck of each package and app, each `i18n:lint`, knip, `openapi:check`, `agent-rules:check`, `test:deploy`, the player E2E when the player changed;
   - Android: `pnpm android:check` and `make -C apps/android lint`;
   - Apple: `make -C apps/apple check` on a simulator you create and delete.
5. Before pushing, the current head's CI must be green on all six workflows. Push the merge to `cw/ux-clarity-audit` as a fast-forward, then watch its CI, the automated review and any new review thread.

## Rules that hold until the end

- Never merge the PR, never deploy production, never force-push, amend or stash.
- Codex writes code, tests and captures; Claude writes the words and reviews every diff a learner sees, once per slice.
- At most 3 simulators and 2 emulators on one machine.
- A red CI on the head stops every other landing until it's green.
