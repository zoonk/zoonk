---
name: zoonk-github-issues
description: Use when filing or updating a Zoonk GitHub issue (its type, priority, labels or links), including a find from another task or a security hole.
---

# GitHub issues

Record the user's problem and desired outcome in the requested repository. A request to create or update an issue authorizes that action; a request to draft or plan does not authorize publication. Inspect the target issue before updating it and preserve unrelated content and metadata.

Several agents file issues at the same time. When each files its own slightly different issue about one problem, separate agents later fix them in parallel with competing approaches. So an issue starts from the issues already open about its problem, and links the ones it relates to.

## Related issues

Before writing an issue, search open and closed issues with a few phrasings of the problem, the way a learner and an engineer would each put it, and with the names of the screen, flow and code it touches. Read the close matches and the issues they link to:

```sh
gh issue list --repo zoonk/zoonk --state all --search "<words>" --json number,title,state,projectItems \
  --jq '.[] | "#\(.number) \(.state) \([.projectItems[].status.name] | join(",")): \(.title)"'
```

- **An open issue describes the same problem**, even in other words or from another screen: don't file. Comment on it with only what's new, such as another case or clearer steps.
- **An open issue shares its cause, or its fix would change the same code and behavior**, so separate PRs would conflict or redo each other's work (for example, two ways a day that waits on lessons drifts from the plan): add your find to that issue as a comment instead of filing another. Several such finds with no open issue go in one issue together.
- **A related issue needs a fix of its own:** file yours and [link them](references/linking.md).
- **Only a closed issue matches:** if it was fixed and the problem is back, file a new issue and mention the old one.

The status after each issue's number comes from the [Zoonk Development](https://github.com/orgs/zoonk/projects/37) board. An issue that's In Progress or In Review has an agent on it, which may not read a new comment until it's too late. When you add to one, also tell that agent if it runs on this machine, finding it the way [addressing an issue](../zoonk-address-issue/SKILL.md#3-make-sure-nobody-else-is-on-them) does.

## Issue content

An ordinary issue usually needs only:

```markdown
## Problem

Describe the current experience, who it affects, and why it matters.

## Desired outcome

Describe how that experience should improve.
```

For a bug someone hit using Zoonk's website or apps, follow [zoonk-bug-report](../zoonk-bug-report/SKILL.md) instead. For other bugs, add observed versus expected behavior and reproduction evidence when available. An idea or feature request from someone who can't write to zoonk/zoonk (`gh api repos/zoonk/zoonk --jq .permissions.push` doesn't print `true`) goes to Discussions, not issues, following [zoonk-feature-request](../zoonk-feature-request/SKILL.md). A security hole never goes in an issue: [file a private advisory](references/security-advisory.md). A motivating example may illustrate a broader problem; do not silently narrow the scope to that example or speculate about an unverified fix.

Do not add architecture, file lists, scope/non-goals, implementation steps, acceptance checklists, tests, commands, or delivery phases by default. Include technical detail when the user asks for a specification or implementation task. Keep parent epics focused on the overall problem.

A thread started for a find outside someone's task confirms the find before filing: follow [a find from another task](references/another-task.md).

## Type, priority, labels and links

Give every new issue one type, a priority in GitHub's Priority field and at least one label ([type, priority and labels](references/metadata.md)), and set every relationship that holds: blocked by, parent, duplicate ([link related issues](references/linking.md)).

## Check again right before filing

Drafting and checking an issue takes a while, and another agent may file the same find, or a related one, in the meantime. Right before you create the issue, look again. GitHub's search can take a few minutes to include a new issue, so also list the newest open issues, which come straight from the repository:

```sh
gh issue list --repo zoonk/zoonk --state open --limit 30 --json number,title,createdAt,projectItems \
  --jq '.[] | "#\(.number) \(.createdAt) \([.projectItems[].status.name] | join(",")): \(.title)"'
```

Run your searches again as well. Handle a new match as in [related issues](#related-issues): add to it, or put your finds together with it, instead of filing another issue.

## Publication and metadata

- Prefer a structured tool argument or `gh issue create --title "..." --body-file <path>` for multiline text. Verify the destination repository from current context or GitHub configuration.
- Use GitHub's native fields for the type, priority and relationships, rather than repeating them in the body.
- Verify issue numbers before cross-referencing them. Local spec numbers and filenames are not GitHub issue numbers; keep a mapping when publishing a breakdown.
- Make the issue self-contained. Temporary local paths are not usable context for a GitHub reader.
- Confirm the created or updated issue and return its link. If a create or a batch partly fails, report completed work and inspect live state before retrying, so a retry doesn't file a duplicate.

For an explicit request to split work into multiple issues, use [zoonk-issue-planning](../zoonk-issue-planning/SKILL.md). A single ordinary issue does not require it.
