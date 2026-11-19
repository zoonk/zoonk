# Lanes

A large task is split among subagents (lanes) whose edits don't overlap. Every slice lands on the task's one branch, and the lead opens the task's one PR ([finishing a task](../../AGENTS.md#finishing-a-task)). Each lane is placed by [models](models.md) and [providers](providers.md).

## Who owns what

- Lanes own screens, and one lane owns the shared pieces (`@zoonk/ui`, the learn kit, the player's components). A lane that needs a piece to do something new asks that lane, or extends the piece in its own slice and says so in its handoff. It never draws its own.
- A lane checks its own slice with tests and the running app, and changes English copy without translating it.
- A lane that finds a rule wrong for its case records it in the task's one file ([when a rule looks wrong](exceptions.md#in-a-task-with-lanes)).

## What the lead does as slices land

Two lanes' copies of one piece, and two lanes' screens that draw one role two ways, show only once the slices are combined, and each lane's readers see only its own.

- Each time a slice lands, run `pnpm verify:diff --base "$(git merge-base origin/main HEAD)"` and settle every duplication lead before the next one.
- Once slices that draw screens are combined, have zoonk-design's [role read](../skills/zoonk-design/references/craft.md#the-role-read) run across every area, and again after a shared piece changes: every screen that draws it is looked at, a lane's "unchanged" ones included.
- A lane's failure notice doesn't always reach its lead. After a machine-wide failure (a full disk, a reboot, a provider outage), or when a lane has been quiet for about an hour, read each lane's status yourself, and resume a failed lane where it ran so it keeps its context and worktree.

## Once per PR, by the agent that owns it

- **Review:** the reviews run once, on the whole branch, before the PR is marked ready ([cross-model review](cross-model-review.md)), never after each lane or fix batch.
- **Translation:** it sends every changed string to a model in every language, so the PR's owner runs each changed app's `i18n` once, after every lane's copy has landed ([translations](translations.md)).
