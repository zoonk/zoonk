---
name: zoonk-release
description: Publish a Zoonk production release when the user asks for one. Pick the release commit and version, write release notes learners want to read (Highlights, Features, Enhancements, Bug Fixes), publish the GitHub release and watch the deployment it starts.
license: MIT
metadata:
  author: zoonk
  version: "1.0.0"
---

# Releases

Publishing a stable GitHub release deploys production: the release workflow checks that the tagged commit passed CI, migrates the production database once and deploys the API, Main and Admin ([releases and hotfixes](../../../.github/DEPLOYMENTS.md#releases-and-hotfixes)). The user's request to create a release approves publishing it. When they ask to review the notes first, create the release as a draft (`--draft`) and hand back its link; publishing the draft starts the deployment.

## 1. Pick the commit and the version

Choose both once and keep them. You can start reading what changed while a CI run you wait for finishes.

- **Last release:** the newest published stable release whose tag is on `main` (`gh release list --exclude-drafts --exclude-pre-releases`, then `git merge-base --is-ancestor <tag> origin/main`). A hotfix's tag sits on its own branch, so the release before it is the base.
- **Release commit:** the newest commit in `git log --first-parent origin/main` whose CI passed (`gh run list --workflow ci.yml --commit <sha>`). When the newest commit's run is still going, wait for that run only, and keep that commit even if `main` moves on. When it failed, take the newest commit that passed and name the ones left out in the handoff.
- **Version:** bump the minor of the newest release's tag, keeping its format (`v2.0` to `v2.1`). A hotfix bumps the patch (`v2.1` to `v2.1.1`), and the major changes only when the user asks. A version the user gives wins. A draft release that already has the version is this release's: finish it instead of creating another.

The tag is the release's version, and nothing in the repository reads it, so a release changes no files. Leave the `version` fields in `package.json` files, the OpenAPI document's `info.version` and the native apps' store versions alone.

A hotfix follows [releases and hotfixes](../../../.github/DEPLOYMENTS.md#releases-and-hotfixes): its release commit is the fix on its branch, and its notes cover that fix.

## 2. Read what changed

Each commit on `main` is a squashed PR whose number ends its subject: `git log --first-parent --format='%h %s' <last release tag>..<release commit>`. Sort them by the paths they touch (`git show --name-only --format= <commit>`) rather than by the scope in their title, which can hide a web change. AI prompts are Markdown files, but they change what learners get. Read the description of every PR that might reach learners (`gh pr view <number> --json title,body`), and open its diff when the description doesn't say what changed for them.

With more than a few dozen PRs to read, group the ones that clearly belong together, then split the reading across subagents by product area, such as calls, lessons, Today and plans, and accounts. Give each the leave-out rules below and what the store lookups found. Each returns, per PR: what a learner notices before and after (or nothing), whether the problem existed at the last release, any numbers the PR measured, and the related PRs it saw.

Leave out what learners don't get from this release:

- Agent instructions, CI, tooling, tests, evals, and refactors or dependency updates that change nothing a learner sees.
- Admin, which only the team uses, and the blog, which deploys on its own.
- Changes to the Apple or Android app while that app isn't in its store: `https://itunes.apple.com/lookup?bundleId=com.zoonk` returns `"resultCount":0`, and `https://play.google.com/store/apps/details?id=com.zoonk` returns a 404. Describe a PR that also changes the web by its web effect, without naming an app that isn't out. Once an app is in its store, include its changes and name the platform.
- Performance work that only counted database statements or queries: learners notice time, not counts.
- What a release since the last release tag already announced, such as a hotfix brought back to `main`.

A fix to something that never reached learners, such as a feature added in this same release, is part of building it: fold it into that feature's item. The code at the last release tag tells you whether the problem shipped.

If nothing left changes what learners get, tell the user and stop.

## 3. Write the notes

The readers are learners and people following Zoonk, not the team. They want to know what they can do now that they couldn't before, what works better and what stopped going wrong. Write in English. Group the PRs that changed the same thing into one item, start with what the learner notices, and end each item with its PR numbers, such as `(#1956, #1965)`.

Place each item by what the learner experiences, not by its commit type: a `fix` can add something new, and a `feat` can polish something that existed. A group goes where its main effect belongs, and a PR that changed two things can appear in two items.

| Section           | What goes there                                                                                                                                                                                      |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `## Highlights`   | The two to four changes that matter most to the most learners. Each gets a `###` heading that says what learners get and a paragraph of a few sentences with a concrete example. Not repeated below. |
| `## Features`     | New things learners can do.                                                                                                                                                                          |
| `## Enhancements` | Things that already existed and now work better: easier, faster, clearer, more accessible.                                                                                                           |
| `## Bug Fixes`    | Things that went wrong for learners in the last release and no longer do. Say what went wrong as they saw it and how it behaves now.                                                                 |

Below Highlights, each item is one bullet of one or two sentences. Leave out an empty section. Most people read the Highlights and skim the rest, so keep the whole thing to about five minutes' read (around 1,000 words): ten small fixes to one screen become one item about that screen, and when a section runs long, cut what the fewest learners would notice. A rare fix can go unless it blocked something completely, such as signing in.

Write the way someone on the team would explain the change to a learner:

- "You" for the learner, "we" for Zoonk, in plain words. No internal names: packages, tables, workflows, components, file paths, model or provider names. Names learners know, such as an exam, a browser or LinkedIn, are fine.
- Say what changed. "Bug fixes and improvements", "improved performance" and "a better experience" say nothing; "Lessons open about twice as fast on a phone" does, when a PR measured it. Quote a number only from a PR that measured it, after checking that no later PR in the release measured it differently. A number measured only before the change describes the wait that went away, not how much faster things got, and a projected number isn't a measurement. Never invent one.
- Run the self-check in [copywriting's AI tells](../copywriting/references/ai-tells.md) on the draft and rewrite what it flags. No em dashes, no "we're excited to", no closing line that sums up the release.

```text
✗ feat(learn): continue a dropped live call when the learner calls again (#1956)
✗ Improved live call reliability. (#1956)
✓ If a call drops, calling again picks it up where it stopped. The character remembers what you already said, and your feedback covers the whole call. (#1956)
```

## 4. Publish and watch

Write the notes to a file outside the repository and publish:

```sh
gh release create <tag> --target <release commit's full sha> --title <tag> --notes-file <notes file>
```

This creates the tag on the release commit and publishes the release. To publish a draft the user reviewed, run `gh release edit <tag> --draft=false`. Either one starts the Production Release workflow: find the run whose branch is the new tag (`gh run list --workflow production.yml --event release`; it can take a few seconds to show up) and wait for it to finish. Investigate a failure from its log: a failed release can leave one app on the new version and another on the old one. Re-run the failed jobs once (`gh run rerun <run id> --failed`) only when the log shows an outage before any of our code ran; never delete and republish the release to retry it.

Hand back with the release link, its tag and commit, the deployment's result, the PRs you cut for length (so the user can bring one back) and the commits left for the next release.
