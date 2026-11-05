---
name: zoonk-release
description: Publish a Zoonk production release when the user asks for one. Pick the release commit and version, write release notes learners want to read (Highlights, Features, Enhancements, Bug Fixes), publish the GitHub release and watch the deployment it starts.
license: MIT
metadata:
  author: zoonk
  version: "1.0.0"
---

# Releases

Publishing a stable GitHub release deploys production: the release workflow checks that the tagged commit passed CI, migrates the production database once and deploys the API, Main and Admin ([deployments](../../../.github/DEPLOYMENTS.md)). The user's request to create a release approves publishing it. When they ask to review the notes first, create the release as a draft (`--draft`) and hand back its link; publishing the draft starts the deployment.

## 1. Pick the commit and the version

- **Last release:** the newest published stable release: `gh release list --exclude-drafts --exclude-pre-releases --limit 1`.
- **Release commit:** the newest `main` commit whose CI passed: `gh run list --workflow ci.yml --branch main --event push --json headSha,status,conclusion`. When the newest commit's run is still going, wait for it, so the release doesn't leave it out. When it failed, release the newest commit that passed and name the commits left for the next release in the handoff.
- **Version:** bump the minor of the last release's tag, keeping its format (`v2.0` to `v2.1`). A hotfix bumps the patch (`v2.1` to `v2.1.1`), and the major changes only when the user asks. A version the user gives wins.

The tag is the release's version, and nothing in the repository reads it, so a release needs no commit. The `version` fields in workspace `package.json` files, the OpenAPI document's `info.version` and the native apps' store versions are not the release version; leave them alone.

A hotfix follows [releases and hotfixes](../../../.github/DEPLOYMENTS.md#releases-and-hotfixes): its release commit is the fix on its branch, and its notes cover that fix.

If nothing since the last release changes what learners get (step 2), tell the user and stop.

## 2. Read what changed

Each commit on `main` is a squashed PR whose number ends its subject. List them with `git log --first-parent --format='%h %s' <last tag>..<release commit>`. Read each PR's title and description (`gh pr view <number> --json title,body`), which say what changed for learners, and open the diff when they don't. Understand what a change does for a learner before you write about it.

On a long range, read the titles first and drop what is clearly left out, then split the rest across subagents by area ([orchestration guide](../../guides/orchestration.md)). Each returns, per PR, what a learner notices, or that they notice nothing.

Leave out what learners don't get from this release:

- Agent instructions, CI, tooling, tests, evals, and refactors or dependency updates that change nothing a learner sees.
- Admin, which only the team uses, and the blog, which deploys on its own.
- Changes to the Apple or Android app while that app isn't in its store (look `com.zoonk` up in the App Store and on Google Play). Once it is, include them and name the platform.
- What the last release's notes already announced, such as a hotfix brought back to `main`.

A fix to something that never reached learners, such as a feature added in this same release, is part of building it: fold it into that feature's item.

## 3. Write the notes

The readers are learners and people following Zoonk, not the team. They want to know what they can do now that they couldn't before, what works better and what stopped going wrong. Group the PRs that changed the same thing into one item, start with what the learner notices, and end each item with its PR numbers, such as `(#1956, #1965)`.

Place each item by what the learner experiences, not by its commit type: a `fix` can add something new, and a `feat` can polish something that existed.

| Section           | What goes there                                                                                                                                                                         |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `## Highlights`   | The two to four changes that matter most to the most learners. Each gets a `###` heading that says what learners get and a short paragraph with a concrete example. Not repeated below. |
| `## Features`     | New things learners can do.                                                                                                                                                             |
| `## Enhancements` | Things that already existed and now work better: easier, faster, clearer, more accessible.                                                                                              |
| `## Bug Fixes`    | Things that went wrong for learners in the last release and no longer do. Say what went wrong as they saw it and how it behaves now.                                                    |

Leave out an empty section. A fix that only a rare path hit can go; ten small fixes to one screen can be one item about that screen. Spend more words on what matters more.

Write the way someone on the team would explain the change to a learner:

- "You" for the learner, "we" for Zoonk, in plain words. No internal names: packages, tables, workflows, components, file paths, model or provider names.
- Say what changed. "Bug fixes and improvements", "improved performance" and "a better experience" say nothing; "Lessons open about twice as fast on a phone" does, when a PR measured it. Make only claims the PRs support, and never invent a number.
- Run the self-check in [copywriting's AI tells](../copywriting/references/ai-tells.md) on the draft and rewrite what it flags. No em dashes, no "we're excited to", no closing line that sums up the release.

```text
✗ feat(learn): continue a dropped live call when the learner calls again (#1956)
✗ Improved live call reliability. (#1956)
✓ If a call drops, calling again picks it up where it stopped. The character remembers what you already said, and your feedback covers the whole call. (#1956)
```

## 4. Publish and watch

Write the notes to a file outside the repository and publish:

```sh
gh release create <tag> --target <release commit sha> --title <tag> --notes-file <notes file>
```

This creates the tag on the release commit and publishes the release, which starts the Production Release workflow. Find its run (`gh run list --workflow production.yml --limit 1`) and wait for it to finish ([orchestration guide](../../guides/orchestration.md)). Investigate a failure like a failing check ([root verification rules](../../../AGENTS.md#verification)): a failed release can leave one app on the new version and another on the old one. Re-run the failed jobs once (`gh run rerun <run id> --failed`) only when the log shows an outage before any of our code ran; never delete and republish the release to retry it.

Hand back with the release link, its tag and commit, the deployment's result, and the commits left for the next release.
