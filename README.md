<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://github.com/user-attachments/assets/df56a63d-e046-4745-9924-a302ef40ea37">
  <source media="(prefers-color-scheme: light)" srcset="https://github.com/user-attachments/assets/84dd27e8-5e2e-4d61-aa73-2c1cede2e4ca">
  <img alt="Minimalist brain icon with a lightning bolt in the center next to the text learn. build. shape." src="https://github.com/user-attachments/assets/84dd27e8-5e2e-4d61-aa73-2c1cede2e4ca">
</picture>

<p align="center">
  Learn anything with step-by-step activities.
  <br />
  <br />
  <a href="https://forms.gle/jHeTqPUkw1vA7wLh8">Waitlist</a>
</p>

> [!CAUTION]
>
> ## Early Development Notice
>
> This project is still in early development and **not ready for use**. There will be breaking changes before stable that won't be backwards compatible. Star this repository or follow us on social media to stay updated.

### Project Status

| Feature                  | Not Started | In Progress | Beta | Stable |
| ------------------------ | :---------: | :---------: | :--: | :----: |
| Learn Anything (Catalog) |             |  :hammer:   |      |        |
| Personalized Lessons     | :calendar:  |             |      |        |
| Editor                   |             |  :hammer:   |      |        |
| Teams                    | :calendar:  |             |      |        |
| Schools                  | :calendar:  |             |      |        |
| White-Label (Creators)   | :calendar:  |             |      |        |
| iOS App                  | :calendar:  |             |      |        |
| Android App              | :calendar:  |             |      |        |
| API                      |             |  :hammer:   |      |        |

## Table of Contents

- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Local Development](#local-development)
- [Overview](#overview)
  - [Apps](#apps)
  - [Packages](#packages)
- [Translations](#translations)
- [Remote Caching](#remote-caching)
- [Supporters](#supporters)

## Getting Started

### Prerequisites

- Node.js v24
- pnpm v10
- PostgreSQL v17

We recommend using [mise](https://mise.jdx.dev/) to manage your Node.js and pnpm versions.

### Installation

- `pnpm install` to install dependencies for all apps and packages
- Check out the [@zoonk/db package README](./packages/db/README.md) for database setup instructions
- Check out the [main app README](./apps/main/README.md) for app-specific setup instructions

### Local Development

- `pnpm dev` to start the development server
- `pnpm build` to create a production build
- `pnpm lint` to run linting
- `pnpm typecheck` to run TypeScript type checking
- `pnpm knip` to check for unused code
- `pnpm test` to run tests with Vitest
- `pnpm e2e` to run end-to-end tests with Playwright

## Overview

### Apps

- [main](./apps/main): Public web app (`zoonk.com`)
- [admin](./apps/admin): Dashboard for managing users and organizations (`admin.zoonk.com`)
- [auth](./apps/auth): Centralized authentication for all apps
- [editor](./apps/editor): Visual editor for building courses and activities (`editor.zoonk.com`)
- [evals](./apps/evals): Local-only tool for evaluating AI-generated content

### Packages

- [ai](./packages/ai): AI prompts, tasks, and helpers for content generation
- [auth](./packages/auth): Shared Better Auth setup and plugins
- [core](./packages/core): Shared server utilities
- [db](./packages/db): Prisma schema and client
- [mailer](./packages/mailer): Email-sending utilities
- [next](./packages/next): Shared Next.js utilities
- [testing](./packages/testing): Shared testing utilities
- [tsconfig](./packages/tsconfig): Shared TypeScript config
- [ui](./packages/ui): Shared React components, patterns, hooks, and styles
- [utils](./packages/utils): Shared utilities and helpers

## i18n

You can use [lingo.dev](https://lingo.dev/) to manage translations for this project. Run `pnpm i18n` from the root directory to translate missing keys.

This is optional. If using `lingo.dev`, make sure to set the `LINGODOTDEV_API_KEY` environment variable in your local `.env` file.

## Remote Caching

We're using [Vercel's Remote Caching](https://vercel.com/docs/monorepos/remote-caching) to speed up our Turborepo tasks. To enable remote caching, authenticate the Turborepo CLI with your Vercel account:

```sh
pnpm turbo login
```

Then, link to the remote cache:

```sh
pnpm turbo link
```

## Supporters

See everyone who has [supported this project](./SUPPORTERS.md).
