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
> This project is still in early development and **not ready for use**. We’re actively working to make it available as soon as possible.
>
> As we progress, we’ll open it for testing and contributions. Star this repository or follow us on social media to stay updated.

## Table of Contents

- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Local Development](#local-development)
- [Remote Caching](#remote-caching)
- [Supporters](#supporters)

## Getting Started

### Prerequisites

- Node.js v22
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
- `pnpm test` to run tests with Vitest

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
