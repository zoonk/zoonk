# Stacked pull requests

Stacks are for separate tasks: one task is always one PR, never a stack ([finishing a task](../../../../AGENTS.md#finishing-a-task)). Read this when another task's PR needs an open PR's unmerged change.

Another task's PR that needs an open PR's unmerged change goes in that PR's GitHub stack, never as a loose PR on its branch. Open it against the branch of the stack's top PR, then link it from a checkout with the `github/gh-stack` extension: `gh stack link <stack number> <pr>`, or `gh stack link <parent pr> <pr>` to start a stack. A stack is one line, each PR on the one below, so a PR that needs one in the middle still goes on top, with the top PR's branch merged into its own. A stacked PR's checks run as they do for `main`, but only on pushes made after it joined, so push once more after linking (an empty commit is fine) and start no workflow by hand. The user then merges the whole stack at once.
