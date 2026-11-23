# Work that waits for a release

Some work can only run once the PR is in production: content fixes that use a capability the PR adds, a backfill, a cleanup the running release still blocks. Nobody remembers it after the handoff, so you schedule it before you hand back, and the trigger starts it on its own.

- **Make a one-shot trigger.** A task your harness runs on the repository's GitHub `release` webhook (event `release`, action `published`), not bound to your thread, so each delivery starts its own run. Work that needs only the merge listens to `pull_request` instead and checks the PR was merged.
- **Its prompt treats the delivery as a claim and reads the facts from GitHub:** the release is published and neither a draft nor a prerelease, the PR is merged and its merge commit is in the tag (`git merge-base --is-ancestor`), and that tag's `production.yml` run succeeded (wait on it with one blocking command). A release without the change, or a failed deploy, keeps the trigger waiting; a PR closed without merging removes it.
- **When the change is live,** it checks no open thread or PR already does the work, starts one worktree thread from `main` with a brief that stands on its own (what shipped, what to do, the issue and PR to read, where to stop for the user), then deletes its webhook and itself.
- **Test it before you hand back** with a fake delivery for the latest tag: it should say the PR isn't released yet and keep the trigger.
- **Say it in the handoff and the PR body:** what will run, on which release, and which thread it starts.

Work a standing trigger already runs needs none of this, such as the schema marks in the [database package](../../../../packages/db/AGENTS.md). If your harness can't schedule, list the work under "After release" in the PR body and the handoff.
