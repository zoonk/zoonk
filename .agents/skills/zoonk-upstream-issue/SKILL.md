---
name: zoonk-upstream-issue
description: Report a bug in a dependency (library, framework or SDK) to its maintainers with a minimal public reproduction repository. Use when a library bug is found or the owner asks for an upstream issue.
license: MIT
metadata:
  author: zoonk
  version: "1.0.0"
---

# Upstream issue with a minimal reproduction

Maintainers act on a bug they can run in a minute. Prove the bug is theirs, reproduce it in the smallest public repository, then file it in their template. The issue and the repository are public: follow [zoonk-post-on-behalf](../zoonk-post-on-behalf/SKILL.md). The owner approves upstream bug reports in advance (root `AGENTS.md`), so open them without asking.

## 1. Confirm it's theirs

- Reproduce on the latest release (`npm view <package> dist-tags`) and check its changelog and recent commits for a fix.
- Read the library's code at that version and name the functions where it goes wrong.
- Search open and closed issues and discussions with several phrasings. If one already covers it, add your evidence there instead.
- Read the docs for the feature: issue templates ask whether the docs cover it.

## 2. Build the reproduction

- Create a new public repository on the owner's personal GitHub (`gh api user --jq .login`), named after the bug, in `~/coding/<login>/<name>-repro`. Keep it outside any workspace so its install stays separate.
- Start from nothing, or from the maintainers' reproduction template, with the latest stable versions. Keep only what the bug needs. Leave out product, company and customer names, internal paths, data and secrets.
- Make it fail by command, with npm so it runs on what ships with Node: `npm install`, then one `npm run` script. Commit `package-lock.json` and pin exact versions. Use another package manager only when the bug depends on it (such as pnpm's `node_modules/.pnpm` layout), and say why in the README.
- For a timing bug, add a script that shows the mechanism on an unmodified run (for example, polling a file the build rewrites). Separately, add an opt-in, clearly labeled shim that widens the window so the failure happens every time. Never patch the library.
- Write the README with: what's broken in one paragraph; Reproduction, with the commands and their exact output; Expected; Actual, naming where in the library's code it goes wrong; Environment (versions and OS).
- Verify from a fresh clone in a new directory before linking it.

## 3. File the issue

- Fill in the project's issue template (`.github/ISSUE_TEMPLATE`). Tick a checkbox only for what you did.
- Lead with what users see, then the mechanism with code pointers, then the steps with their exact output, the expected behavior and possible fixes. Link related issues. Say how often it happened in the real app without naming it.
- Add the disclosure from zoonk-post-on-behalf, post with `gh issue create --repo <owner/repo> --title "…" --body-file <file>`, then open the issue to check it rendered.

## 4. Close the loop

- Link the issue from the reproduction's README.
- In this repository, record the issue under the PR description's library issues and in memory, and keep or remove any local workaround as the owner decided.
- Give the owner both links.
