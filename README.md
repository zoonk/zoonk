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
- [Supporters](#supporters)

## Getting Started

### Prerequisites

- Node.js v24
- pnpm v12
- PostgreSQL v18

We recommend using [mise](https://mise.jdx.dev/) to manage your Node.js and pnpm versions.

### Installation

- `pnpm install` to install dependencies for all apps and packages
- Check out the [@zoonk/db package README](./packages/db/README.md) for database setup instructions
- Check out the [main app README](./apps/main/README.md) for app-specific setup instructions

### Local Development

- `pnpm dev` to start every app through Portless. Routes include the clone name, such as `http://main.zoonk.localhost:1355`, and linked worktrees also receive a branch prefix
- `pnpm dev:lan` when testing from a phone or another device on the same trusted network. It prints the `.local` Main URL to open on that device, such as `http://main.zoonk.local:1356`
- `pnpm dev:direct` to bypass Portless and use the original fixed localhost ports
- `pnpm dev:prune` to let Portless remove orphaned servers left by crashed sessions. Stop active development stacks from the terminal where they are running
- `pnpm build` to create a production build
- `pnpm lint` to run linting
- `pnpm typecheck` to run TypeScript type checking
- `pnpm knip --production` to check for unused code
- `pnpm test` to run tests with Vitest
- `pnpm e2e` to run end-to-end tests with Playwright, or `pnpm e2e:main` and `pnpm e2e:api` for one app (they pass further arguments, such as a test file, to Playwright)
- `pnpm i18n:lint` to run i18n linting
- `pnpm i18n` to translate missing i18n keys

### Working with Git worktrees

Codex, T3 Code, and Claude Code run `pnpm worktree:setup` when they create a worktree and wait for it before the agent starts: Codex through `.codex/environments/zoonk.toml`, T3 Code through the Setup action in `t3.json` (import it once from the project's Actions menu, under From t3.json), and Claude Code through the `WorktreeCreate` hook in `.claude/settings.json`, which creates its worktrees in `.claude/worktrees/` from the session's current commit. For other tools, run it once in the new worktree after `git worktree add`. It installs dependencies, generates Prisma, and prepares isolated development, test, and E2E databases when the primary checkout has a local `zoonk` database. Keep using `pnpm dev`, `pnpm test`, and `pnpm e2e` normally.

See [worktree database setup](./packages/db/README.md#worktree-databases) for prerequisites, cleanup, and recovery.

## Supporters

<br />
<a href="https://vercel.com/open-source-program">
  <img alt="Vercel OSS Program" src="https://vercel.com/oss/program-badge-2026.svg" />
</a>
<br />
<br />

See everyone who has [supported this project](./SUPPORTERS.md).
