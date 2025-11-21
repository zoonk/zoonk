<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://github.com/user-attachments/assets/345ed7d9-40a8-4ebb-adf1-8f22cafa492d">
  <source media="(prefers-color-scheme: light)" srcset="https://github.com/user-attachments/assets/8d018809-14b9-435b-9409-d515c599335d">
  <img alt="Zoonk logo (a smiley brain) on the first line. Below it says 'learn anything with interactive courses'" src="https://github.com/user-attachments/assets/8d018809-14b9-435b-9409-d515c599335d">
</picture>

<p align="center">
  Web app for learning anything using AI.
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
- [Social Media](#social-media)
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

## Social Media

- [X](https://x.com/zoonkcom)
- [Bluesky](https://bsky.app/profile/zoonk.bsky.social)
- [Threads](https://www.threads.net/@zoonkcom)
- [LinkedIn](https://www.linkedin.com/company/zoonk)

## Supporters

People who supported this project:

- [Sephora Lillian](https://github.com/sephoralillian)
- [Ben Biran](https://github.com/benbiran)
- [David Szabo-Stuban](https://github.com/ssdavidai)
- [Gustavo A. Castillo](https://github.com/guscastilloa)
- [Greg Lind](https://github.com/glind)
