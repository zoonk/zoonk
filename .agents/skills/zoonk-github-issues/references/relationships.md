# GitHub issue relationships

Read this reference when the requested issue work needs dependencies or parent-child relationships. The commands use `zoonk/zoonk`; verify that it is the requested repository and replace example numbers with verified issue numbers. Run only the mutations requested by the user. Inspect existing state before adding or removing relationships, and verify the resulting relationship afterward.

For GraphQL sub-issues, use node IDs (`gh issue view 123 --repo zoonk/zoonk --json id --jq .id`). For REST dependencies, use the numeric database ID and `-F issue_id=...`, not the issue number, node ID, or a string passed with `-f`. If an operation fails, inspect the actual API error and current permissions/schema before retrying.

## Dependencies (Blocked-By)

Dependencies track when one issue blocks another. Use the REST API with **database IDs** (integers), not node IDs.

### Get Issue Database ID

The REST API for dependencies requires the integer database ID, not the GraphQL node ID:

```bash
# Get database ID for an issue
gh api repos/zoonk/zoonk/issues/123 --jq '.id'
# Returns something like: 3858025102
```

### Add Dependency (Issue A blocks Issue B)

First get the blocking issue's database ID, then use `-F` (uppercase) to pass it as an integer:

```bash
# Get the blocking issue's database ID
BLOCKING_DB_ID=$(gh api repos/zoonk/zoonk/issues/BLOCKING_NUMBER --jq '.id')

# Add dependency: BLOCKED_NUMBER is blocked by BLOCKING_NUMBER
gh api repos/zoonk/zoonk/issues/BLOCKED_NUMBER/dependencies/blocked_by \
  --method POST \
  -F issue_id=$BLOCKING_DB_ID
```

**Important**: Use `-F` (uppercase) not `-f` (lowercase). The `-F` flag passes the value as a raw integer, while `-f` passes it as a string which will cause a 422 error.

### Verify Dependencies

```bash
gh api repos/zoonk/zoonk/issues/ISSUE_NUMBER --jq '.issue_dependencies_summary'
# Returns: {"blocked_by":1,"blocking":0,"total_blocked_by":1,"total_blocking":0}
```

### Remove Dependency

```bash
gh api repos/zoonk/zoonk/issues/BLOCKED_NUMBER/dependencies/blocked_by/BLOCKING_DB_ID \
  --method DELETE
```

## Sub-Issues

Sub-issues create parent-child relationships, useful for breaking down epics.

### Add Sub-Issue

```bash
gh api graphql -f query='
  mutation($parentId: ID!, $childId: ID!) {
    addSubIssue(input: {issueId: $parentId, subIssueId: $childId}) {
      issue { title }
      subIssue { title }
    }
  }' -f parentId="PARENT_NODE_ID" -f childId="CHILD_NODE_ID"
```

### Remove Sub-Issue

```bash
gh api graphql -f query='
  mutation($parentId: ID!, $childId: ID!) {
    removeSubIssue(input: {issueId: $parentId, subIssueId: $childId}) {
      issue { title }
      subIssue { title }
    }
  }' -f parentId="PARENT_NODE_ID" -f childId="CHILD_NODE_ID"
```

### List Sub-Issues

```bash
gh api graphql -f query='
  query($owner: String!, $repo: String!, $number: Int!) {
    repository(owner: $owner, name: $repo) {
      issue(number: $number) {
        subIssues(first: 50) {
          nodes { number title state }
        }
      }
    }
  }' -f owner='zoonk' -f repo='zoonk' -F number=123
```

## Publication bookkeeping

Keep a mapping from local spec names to created GitHub issue numbers. Spec numbers are not GitHub issue references. Before retrying a create after an uncertain response, check whether it succeeded so a partial batch does not create duplicates.

GitHub already displays types, parents, sub-issues, and blocked-by relationships. Do not duplicate that metadata or temporary spec paths in issue bodies. Use verified issue links only when they add explanatory context.

For changes to these recipes or API failures, consult the current [GitHub REST dependency documentation](https://docs.github.com/en/rest/issues/issue-dependencies) and [GraphQL reference](https://docs.github.com/en/graphql/reference).
