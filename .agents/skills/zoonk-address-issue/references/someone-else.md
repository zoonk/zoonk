# Someone else is on it

What to do when [making sure nobody else is on them](../SKILL.md#3-make-sure-nobody-else-is-on-them) finds an open PR or another agent.

## An open PR

If an open PR addresses this issue, don't start another. Link it if it isn't linked, so merging it closes the issue, then check `closedByPullRequestsReferences` again:

```sh
gh api graphql -f query='
  mutation($issue: ID!, $pr: ID!) {
    addCloseIssueReferences(input: {issueId: $issue, pullRequestIds: [$pr]}) { issue { url } }
  }' -f issue="$(gh issue view <n> --repo zoonk/zoonk --json id --jq .id)" \
  -f pr="$(gh pr view <pr> --repo zoonk/zoonk --json id --jq .id)"
```

If the PR covers only part of the issue, comment on the issue with its link instead, so merging it leaves the issue open. Then hand back with the PR, and say if it looks abandoned (no recent commits, failing checks nobody fixed).

## Another agent

- **An agent on this machine has one of them:** whichever of you began working on these issues first keeps them all, whatever the board says, so compare when each of you was asked to take its issue, not when its thread or session was created. If you began first, carry on, and message that agent so it stops and hands you what it found. Otherwise don't start your own work: when that agent is on a related issue rather than this one, message it and ask it to address this one too, since they're related, naming both issues, what connects them and what you've found. Then hand back saying which agent has it.
- **No agent here has them, but this issue is In Progress, or a related one is In Progress, In Review or addressed by an open PR:** someone elsewhere is likely on it, or an agent your harness can't see. Tell the user that the related issue is already In Progress or In Review, that someone else is likely on it, and that the two should be handled together. Then hand back.
