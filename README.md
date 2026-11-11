<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./.github/assets/banner-dark.png">
  <source media="(prefers-color-scheme: light)" srcset="./.github/assets/banner-light.png">
  <img alt="Zoonk logo next to the text: Turn your goal into a daily learning plan." src="./.github/assets/banner-light.png">
</picture>

<p align="center">
  Tell us your goal in your own words. Zoonk plans every day until your date, with lessons, practice and reviews shaped by it.
  <br />
  <br />
  <a href="https://www.zoonk.com">Try for free</a>
</p>

## Table of Contents

- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Local Development](#local-development)
- [Reporting bugs](#reporting-bugs)
- [Suggesting features](#suggesting-features)
- [Supporters](#supporters)

## Getting Started

### Prerequisites

- Node.js v26
- pnpm v12
- PostgreSQL v18, running on this machine

We recommend using [mise](https://mise.jdx.dev/) to manage your Node.js and pnpm versions. On macOS, install PostgreSQL with `brew install postgresql@18 && brew services start postgresql@18` and put `$(brew --prefix postgresql@18)/bin` on your `PATH`. On a Linux machine or a cloud agent, `bash scripts/cloud/setup.sh` installs all three ([cloud agents](./.agents/guides/development.md#cloud-agents)).

### Installation

1. `pnpm install` to install dependencies for all apps and packages
2. `pnpm db:setup` to create the local development, test, and E2E databases, apply migrations, and seed new ones. It connects as `postgres:postgres@localhost:5432` (creating that role if it can) and never resets a database it didn't create, so rerun it whenever you like
3. `pnpm dev` to start the apps

No environment variable is required: the apps use local defaults, sign-in codes land in the local mailbox, and services you haven't configured stay off. Anything that generates, such as plans and lessons, goes through AI Gateway: with access to Zoonk's Vercel team, sign in to the Vercel CLI and link the apps ([development guide](./.agents/guides/development.md#local-development-and-sign-in)); otherwise set your own `AI_GATEWAY_API_KEY` in `apps/main/.env` and `apps/api/.env`. Each app's `.env.example` lists what the other keys turn on.

### Local Development

- `pnpm dev` to start every app through Portless. Routes include the clone name, such as `http://main.zoonk.localhost:1355`, and linked worktrees also receive a branch prefix
- `pnpm dev:lan` when testing from a phone or another device on the same trusted network. It prints the `.local` Main URL to open on that device, such as `http://main.zoonk.local:1356`
- `pnpm dev:direct` to bypass Portless and use the original fixed localhost ports
- `pnpm dev:prune` to let Portless remove orphaned servers left by crashed sessions. A stack's services stop by themselves within seconds of its `pnpm dev` or `pnpm start` ending, even when that process is force-killed
- `pnpm build` to create a production build
- `pnpm start` to build every app and serve the production builds at the same Portless URLs as `pnpm dev`, with local sign-in and the mailbox working the same way. Stop the checkout's `pnpm dev` first, since both use the same routes
- `pnpm lint` to run linting
- `pnpm typecheck` to run TypeScript type checking
- `pnpm knip --production` to check for unused code
- `pnpm test` to run tests with Vitest
- `pnpm e2e` to run end-to-end tests with Playwright, or `pnpm e2e:main` and `pnpm e2e:api` for one app (they pass further arguments, such as a test file, to Playwright)
- `pnpm i18n:lint` to run i18n linting
- `pnpm i18n` to translate missing i18n keys

### Working with Git worktrees

Codex, T3 Code, and Claude Code run `pnpm worktree:setup` when they create a worktree and wait for it before the agent starts: Codex through `.codex/environments/zoonk.toml`, T3 Code through the Setup action in `t3.json` (import it once from the project's Actions menu, under From t3.json), and Claude Code through the `WorktreeCreate` hook in `.claude/settings.json`, which creates its worktrees in `.claude/worktrees/` from the session's current commit. For other tools, run it once in the new worktree after `git worktree add`. It installs dependencies, generates Prisma, and prepares the worktree's own development, test, and E2E databases on the local PostgreSQL server; the development copy starts as a snapshot of the primary checkout's `zoonk` when there is one. Keep using `pnpm dev`, `pnpm test`, and `pnpm e2e` normally.

See [worktree database setup](./packages/db/README.md#worktree-databases) for prerequisites, cleanup, and recovery.

## Contributing

We're not accepting pull requests from external contributors right now. See [contributing](./CONTRIBUTING.md) for how to report bugs and share ideas instead.

## Reporting bugs

See [reporting bugs](./CONTRIBUTING.md#reporting-bugs). AI agents filing a report for someone: follow the [bug report guide](./.agents/skills/zoonk-bug-report/SKILL.md).

## Suggesting features and sharing feedback

See [suggesting features and sharing feedback](./CONTRIBUTING.md#suggesting-features-and-sharing-feedback). AI agents posting an idea for someone: follow the [feature request guide](./.agents/skills/zoonk-feature-request/SKILL.md).

## Supporters

<br />
<a href="https://vercel.com/open-source-program">
  <img alt="Vercel OSS Program" src="https://vercel.com/oss/program-badge-2026.svg" />
</a>
<br />
<br />

See everyone who has [supported this project](./SUPPORTERS.md).
