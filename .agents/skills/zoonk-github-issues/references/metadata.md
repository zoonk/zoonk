# Type, priority and labels

Every new issue gets one type, a priority and at least one label, in GitHub's own fields.

## Type

Give every new issue one of the organization's issue types: `gh issue create --type <name>`, or `gh issue edit <number> --type <name>` for an existing one.

| Type        | Use for                                                                                                         |
| ----------- | --------------------------------------------------------------------------------------------------------------- |
| Bug         | Something doesn't do what it's meant to: an error, a wrong result, a broken screen.                             |
| Enhancement | Something does what it's meant to but should do more or better: weak UX, a missing capability, an idea.         |
| Task        | A specific piece of work: one part of an epic, or upkeep such as removing a workaround once a dependency ships. |
| Epic        | A parent that groups several issues for one large piece of work.                                                |

## Priority

Give every new issue a priority from its severity in GitHub's Priority issue field, not in a label or the body. Severity is the harm the problem does today, judged from what you verified: how many learners it reaches, how badly, and whether they can get around it. How hard the fix is doesn't change it, but what the fix must change can raise it (below).

| Priority    | Severity                                                                                                                                                                 |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Urgent (P0) | Zoonk or a core flow, such as signing in, learning or paying, is down for most learners, or something does lasting harm right now, like losing data or running up costs. |
| High (P1)   | A core flow fails or gives a wrong result for some learners with no way around it, such as lost progress, a wrong grade or a wrong charge.                               |
| Medium (P2) | A problem learners can get around, a failure in a less-used flow, or UX that confuses or slows them down.                                                                |
| Low (P3)    | Cosmetic issues, rare edge cases, developer tooling and tests, and follow-ups such as removing a workaround once a dependency ships.                                     |

An issue whose fix changes an AI prompt, the database schema or how course content is generated, or makes content we already generated get regenerated, edited or reset, is at least High, whatever its severity. Every day it waits, more content is generated the old way and more learners study it, so its migration and regeneration keep growing.

When an issue sits between two levels, pick the lower one; priorities that drift up stop meaning anything. Set it right after creating the issue, with a rationale under 280 characters saying who it affects and how badly, or which of those changes its fix needs. Look up the field and option IDs, then set the value:

```sh
gh api graphql -f query='{ organization(login: "zoonk") { issueFields(first: 20) { nodes { ... on IssueFieldSingleSelect { id name options { id name } } } } } }' \
  --jq '.data.organization.issueFields.nodes[] | select(.name == "Priority")'

gh api graphql -f query='
  mutation($issueId: ID!, $fieldId: ID!, $optionId: ID!, $rationale: String!) {
    setIssueFieldValue(input: {issueId: $issueId, issueFields: [{fieldId: $fieldId, singleSelectOptionId: $optionId, rationale: $rationale}]}) {
      issue { url }
    }
  }' -f issueId="$(gh issue view <number> --repo zoonk/zoonk --json id --jq .id)" \
  -f fieldId=<field id> -f optionId=<option id> -f rationale="<who it affects and how badly>"
```

When updating an issue, change its priority only when what you learned changes its severity or shows its fix needs one of the changes above.

## Labels

Give every new issue at least one label: one for each app or package the problem is in, such as `main:gameplay`, `packages:core` or `ios:player` (the Apple app's labels start with `ios:`). List them with `gh label list --repo zoonk/zoonk --limit 200`, check how recent issues about the same screen or code are labeled, and pass each with `--label <name>`, or `gh issue edit <number> --add-label <name>` for an existing issue. Skip labels for an app or package that's no longer in the repo.

When no label fits, create the one the issue needs, not a set of them:

- Name it `<prefix>:<area>`, with the prefix the app's other labels use (`packages` for a package) and an area that will last, like a screen or feature (`plan`) rather than the bug.
- Give it its prefix's color. A new prefix, for a part of the repo no label covers yet, gets a color no other prefix uses.
- Describe what it covers in a few words.

```sh
gh label create <prefix>:<area> --repo zoonk/zoonk --color <prefix's color> --description "<what it covers>"
```

When updating an issue that has no label, add one.
