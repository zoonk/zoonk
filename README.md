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
  - [Turborepo](#turborepo)
    - [Remote Caching](#remote-caching)
  - [Installation](#installation)
  - [Local Development](#local-development)
    - [Adding dependencies](#adding-dependencies)
    - [Adding shadcn components](#adding-shadcn-components)
- [Social Media](#social-media)
- [Supporters](#supporters)

## Getting Started

### Prerequisites

- Node.js v22
- pnpm v10
- PostgreSQL v17

We recommend using [mise](https://mise.jdx.dev/) to manage your Node.js and pnpm versions.

### Turborepo

We're using [Turborepo](https://turborepo.com) as our monorepo tool to manage multiple packages and applications within a single repository. If you haven't already, please install Turborepo globally:

```sh
pnpm add turbo --global
```

#### Remote Caching

We're using [Vercel's Remote Caching](https://vercel.com/docs/monorepos/remote-caching) to speed up our Turborepo tasks. To enable remote caching, authenticate the Turborepo CLI with your Vercel account:

```sh
turbo login
```

Then, link to the remote cache:

```sh
turbo link
```

### Installation

- `pnpm install` to install dependencies for all apps and packages
- Check out the [@zoonk/db package README](./packages/db/README.md) for database setup instructions

### Local Development

- `turbo dev` to start the development server
- `turbo build` to create a production build
- `turbo lint` to run linting
- `turbo type-check` to run TypeScript type checking
- `turbo test` to run tests with Vitest

#### Adding dependencies

Check the Turborepo guide for [managing dependencies](https://turborepo.com/docs/crafting-your-repository/managing-dependencies).

You can add a dependency to a specific package or app by running:

```sh
# package
pnpm add <package-name> --filter=@zoonk/ui

# app
pnpm add <package-name> --filter=main
```

#### Adding shadcn components

To add components, run the add command in the path of our app:

```sh
cd apps/main
pnpm dlx shadcn@canary add [COMPONENT]
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
