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
  - [PostgreSQL Setup](#postgresql-setup)
  - [Prisma Setup](#prisma-setup)
  - [Local Development](#local-development)

## Getting Started

### Prerequisites

- Node.js v22 or higher
- pnpm v10 or higher
- PostgreSQL v17 or higher

You can install multiple Node.js and pnpm versions using [mise](https://mise.jdx.dev/).

### Installation

- `pnpm install` to install dependencies
- `cp .env.example .env` and fill in the required environment variables

### PostgreSQL Setup

For macOS users, you can install PostgreSQL using Homebrew:

```bash
brew install postgresql
brew services start postgresql
```

Then, create a new database:

```bash
createdb zoonk
```

Update the `DATABASE_URL` in your `.env` file with your PostgreSQL credentials. It will look something like this:

```bash
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/zoonk"
```

### Prisma Setup

Run the following commands to set up Prisma:

- `pnpm prisma generate` to generate Prisma client
- `pnpm db:migrate` to run migrations and set up the database
- `pnpm db:reset` to reset the database (this will erase all data)
- `pnpm prisma migrate dev --create-only` to create a new migration without applying it

### Local Development

- `pnpm dev` to start the development server
- `pnpm build` to create a production build
- `pnpm start` to start the production server
- `pnpm lint` to run linting
- `pnpm format` to format the code according to our Biome configuration
- `pnpm prisma studio` to open Prisma Studio and inspect your database
- `pnpm type-check` to run TypeScript type checking
- `pnpm test` to run tests with Vitest
- `pnpm i18n` to check for missing or unused i18n keys

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
