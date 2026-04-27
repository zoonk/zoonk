<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://github.com/user-attachments/assets/df56a63d-e046-4745-9924-a302ef40ea37">
  <source media="(prefers-color-scheme: light)" srcset="https://github.com/user-attachments/assets/84dd27e8-5e2e-4d61-aa73-2c1cede2e4ca">
  <img alt="Minimalist brain icon with a lightning bolt in the center next to the text learn. build. shape." src="https://github.com/user-attachments/assets/84dd27e8-5e2e-4d61-aa73-2c1cede2e4ca">
</picture>

<p align="center">
  The open-source platform for interactive learning.
  <br />
  <br />
  <a href="https://forms.gle/jHeTqPUkw1vA7wLh8">Waitlist</a>
</p>

> [!CAUTION]
>
> ## Early Development Notice
>
> This project is still in early development and **not ready for use**. There will be breaking changes before stable that won't be backwards compatible. Star this repository or follow us on social media to stay updated.

## Table of Contents

- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Local Development](#local-development)
- [Supporters](#supporters)

## Getting Started

### Prerequisites

- Node.js v24
- pnpm v10
- PostgreSQL v18

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
- `pnpm knip --production` to check for unused code
- `pnpm test` to run tests with Vitest
- `pnpm e2e` to run end-to-end tests with Playwright

## Supporters

See everyone who has [supported this project](./SUPPORTERS.md).
