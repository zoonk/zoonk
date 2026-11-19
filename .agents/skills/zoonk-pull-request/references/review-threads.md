# Review threads: list, reply, resolve

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

Some reviewers post findings as PR comments (`gh pr view <pr> --comments`), which have no thread to resolve. Answer each with a PR comment that quotes its title and says what you did.
