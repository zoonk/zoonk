---
name: zoonk-update-dependencies
description: Refresh all project dependencies, including native apps and GitHub Actions.
license: MIT
metadata:
  author: zoonk
  version: "1.0.0"
---

# Update Zoonk dependencies

1. Create and switch to a new `cw/` branch before updating dependencies.
2. Remove overrides added to fix `pnpm audit` from `pnpm-workspace.yaml`, such as a temporary `nanoid` override. Add a comment explaining the reason for every retained or newly added override, including audit remediations. Preserve intentional overrides, including `"ai-sdk-provider-codex-cli>@openai/codex": "-"` and `katex: "catalog:"`.
3. Update pnpm to the latest stable version in `package.json` and any explicit CI pins. Use that version locally; CI that reads `packageManager` needs no duplicate pin.
4. Run `pnpm -r up --latest`. Ensure the root package and shared catalogs are updated too.
5. Manually bump existing prerelease dependencies to the latest release on their current channel, such as the latest `workflow` beta. Determine these from the current manifests; `--latest` does not advance all prereleases.
6. Keep `@types/node` aligned with the project's current Node.js major, as declared in `package.json` and CI. For example, retain `^24` while the project uses Node.js 24.
7. Run `pnpm outdated --include-github-actions` and update outdated GitHub Actions.
8. Read release notes and/or changelogs for all updated dependencies across the versions being upgraded. Implement required code and configuration changes. Also identify useful new features for this project; list them with their benefits at the end of the task without implementing them. If an i18n upgrade changes message keys, migrate them while preserving existing translations rather than retranslating unchanged text.
9. Delete all existing `node_modules` directories within the active checkout and the root `pnpm-lock.yaml`, then run `pnpm install` from scratch.
10. Run `pnpm audit --fix override`, then `pnpm install` again. Review `peerDependencyRules` against the updated packages and remove exceptions that are no longer needed. Run `pnpm audit` and `pnpm peers check`, resolving remaining dependency issues. Review any further version changes introduced by fresh resolution or audit fixes for required migrations.
11. Use the project's current scripts to fix formatting and run lint with auto-fix. Temporarily disable newly introduced failing rules that require manual fixes, keeping auto-fixable rules enabled. Track the rules disabled during this update. Check whether affected code has real consumers before fixing it; remove unused code, exports, and associated tests, and check unused code beyond what the configured tooling detects.
12. Read `.github/workflows/` and the scripts they invoke, then run all CI checks locally with their required setup and matrix coverage. If Playwright changed, install the matching browsers locally before running browser tests. Fix failures caused by the upgrade.
13. Analyze the temporarily disabled lint rules. Read each rule's documentation, fix valid violations and re-enable the rules. Keep an exception only for a verified false positive or a concrete conflict with intended behavior, document the reason, and scope it narrowly. The amount of work required is not a reason to disable a rule. When dependency migrations or lint fixes change application code, also run the app in the browser and manually exercise the affected flows, including relevant error and retry paths; passing automated checks alone is insufficient.
14. Update Android and Apple native dependencies and build tooling, including their resolution files. Read their release notes, implement required migrations, and keep each platform's toolchain compatible. Run their checks from the current CI definitions, then launch each app in its simulator or emulator and manually exercise its main flows to confirm it still works.

Finish with the dependency refresh and required migrations verified. For each behavior change, report the browser route, interactions performed, and observed results alongside automated coverage; explicitly identify anything not manually verified. Include unresolved updates or checks, lint-rule decisions, and useful new features to consider.
