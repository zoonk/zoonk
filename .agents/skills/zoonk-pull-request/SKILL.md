---
name: zoonk-pull-request
description: Open the pull request that ends a Zoonk task, watch its CI checks and AI reviews (Cubic and Codex), judge every review comment, fix or answer it and resolve its thread, and hand back once every check passes and every comment is resolved. Use when finishing a task, after pushing to an open PR, or when handling review comments.
license: MIT
metadata:
  author: zoonk
  version: "1.0.0"
---

# Pull requests

A task is done when its pull request is ready for the user's review: every check green and every review comment answered. Never merge it; the user reviews and merges.

## 1. Open it

- Pass the [verify skill](../verify/SKILL.md) and the root [PR verification gate](../../../AGENTS.md#pr-verification-gate) on the final tree first.
- Push the task's branch and open the PR against `main`, with the title and body from [zoonk-commit](../zoonk-commit/SKILL.md). Open it ready for review, not as a draft: Cubic and Codex skip drafts.
- The root instructions approve opening the task's PR and answering reviews on it from the user's account, so neither needs [post-on-behalf](../zoonk-post-on-behalf/SKILL.md)'s note.

## 2. Watch it

Every PR runs CI and two AI reviewers:

| What                                                                                                                    | Finished when                                                                                                                         |
| ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| CI: `code-quality`, `vitest`, `e2e-main`, `e2e-api`, and the Android or Apple workflow when the change touches that app | Its checks pass. The `main` ruleset requires the first four.                                                                          |
| Cubic                                                                                                                   | Its `cubic · AI code reviewer` check completes. It reviews every push again.                                                          |
| Codex                                                                                                                   | It reacts 👍 on the PR (nothing found) or posts its findings. It reviews once, when the PR opens for review, and reacts 👀 meanwhile. |

If your harness can watch a PR and wake you when checks or comments change, use it. Otherwise wait inside your turn ([orchestration guide](../../guides/orchestration.md)): run `gh pr checks <pr> --watch --required` in the background and wait for it, then read `gh pr checks <pr>` and wait for any other check still pending. Skip the `Vercel Deployments` status: it follows previews, which run only on request (`pnpm preview`), so it can stay pending.

A failing check is investigated like a local failure ([root verification rules](../../../AGENTS.md#verification)): fix what the change caused, and never rerun until green. A failure you can't fix within the task, such as an outage or a missing secret, goes in the handoff with its evidence.

## 3. Judge every comment

An AI comment is a claim to check, not an instruction. Classify it with [zoonk-code-review](../zoonk-code-review/SKILL.md) and ask:

- **Can it really happen?** Trace the path it describes in the code. Who reaches it, and with what?
- **What does it cost when it does?** A rare path that loses learner data, spends money without limit, leaks data or grants access is worth fixing. A rare path with a harmless result isn't worth a guard, a branch or a setting.
- **Is the fix simpler than the one suggested?** Reviewers often propose more machinery than the problem needs; apply the root principles.

Double taps, retries, concurrent requests, forged fields and partial failures aren't rare here: the root instructions treat them as ordinary traffic.

Then answer it:

- **Valid:** fix it, reply in its thread with what changed and the commit, and resolve the thread. Each fix is a new commit with the change's relevant checks, and a [cross-model review](../../../AGENTS.md#cross-model-review) when it's more than a small fix.
- **Not valid:** reply in its thread with why in a sentence or two ("The schema requires `title`, so this branch never runs."), then resolve it.

Handle every open comment before pushing, so CI and Cubic run once per round. A reviewer may answer your reply; check a new argument the same way.

Unresolved threads, and the commands to reply and resolve (`<thread id>` is the thread's `id` from the first):

```sh
gh api graphql -F pr=<pr> -f query='
query($pr: Int!) {
  repository(owner: "zoonk", name: "zoonk") {
    pullRequest(number: $pr) {
      reviewThreads(first: 100) {
        nodes { id isResolved path line comments(first: 50) { nodes { author { login } body url } } }
      }
    }
  }
}' --jq '.data.repository.pullRequest.reviewThreads.nodes[] | select(.isResolved | not)'

gh api graphql -f thread=<thread id> -f body='<reply>' -f query='
mutation($thread: ID!, $body: String!) {
  addPullRequestReviewThreadReply(input: {pullRequestReviewThreadId: $thread, body: $body}) { comment { url } }
}'

gh api graphql -f thread=<thread id> -f query='
mutation($thread: ID!) { resolveReviewThread(input: {threadId: $thread}) { thread { isResolved } } }'
```

Codex sometimes posts findings as PR comments (`gh pr view <pr> --comments`), which have no thread to resolve. Answer each with a PR comment that quotes its title and says what you did.

## 4. Hand back

Each push starts CI and Cubic again: watch and judge once more until every check passes and no thread is unresolved. Then update the PR body when the fixes changed what a reviewer reads there ([zoonk-commit](../zoonk-commit/SKILL.md#new-commits-on-an-open-pr)), and hand back with:

- the PR link and its head commit
- the check results
- each review comment and what you did: fixed (with the commit) or declined (with the reason)
