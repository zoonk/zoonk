# Zoonk DB

This package contains all schemas the DB client for interacting with our database. We're using [Prisma](https://www.prisma.io/) as our ORM.

### PostgreSQL Setup

For macOS users, install PostgreSQL 18 using Homebrew:

```bash
brew install postgresql@18
brew services start postgresql@18
```

If `createdb` or `psql` are not available after installation, add PostgreSQL 18 to your shell `PATH`:

```bash
export PATH="$(brew --prefix postgresql@18)/bin:$PATH"
```

Then, create a new database:

```bash
createdb zoonk
```

#### Testing

Create a separate database for testing:

```bash
createdb zoonk_test
```

Our testing setup expects a `postgres` user with a `postgres` password. If you haven't set this up yet, you can do so by running:

```bash
psql postgres
```

Then, in the PostgreSQL prompt, run:

```sql
CREATE ROLE postgres WITH LOGIN SUPERUSER PASSWORD 'postgres';
```

#### Environment Variables

Prisma generates a client that we use to interact with our database. We generate this client when running `pnpm install` and `pnpm dev` in the root of the monorepo.

For local development, make sure to set up your `.env` file with the correct `DATABASE_URL`. You can copy the example file:

```sh
cp .env.example .env
```

You also need to add the `DATABASE_URL` to your `.env` file for every app that uses this package.

#### Prisma Setup

Run the following commands to set up Prisma:

- `pnpm db:generate` to generate Prisma client
- `pnpm db:migrate` to run migrations and set up the database

#### Local Curriculum Content

The local `zoonk` database is the source of truth for development curriculum content. The regular Prisma seed only creates local users, accounts, subscriptions, organizations, enrollments, and progress; it does not create courses or lesson content.

To refresh the local curriculum from a database copy, provide its connection string for this command:

```sh
pnpm --filter @zoonk/db db:seed
CONTENT_SOURCE_DATABASE_URL='postgresql://...' pnpm --filter @zoonk/db db:sync-content
pnpm --filter @zoonk/db db:seed
```

The content sync accepts only local development databases: `zoonk` or `zoonk_wt_<id>_dev`. It replaces the AI organization's courses, categories, chapters, lessons, vocabulary, sentences, pronunciations, resource links, and steps without importing source users or progress. Existing local prompt links, enrollments, completions, lesson progress, and attempts are mapped onto matching content in the replacement; the whole operation rolls back if any mapping is missing. Run the regular seed before the first sync to create the local AI organization, then run it afterward to initialize content-linked seed data on a new database.

#### Useful Commands

- `pnpm db:reset` to reset the database (this will erase all data)
- `pnpm db:studio` to open Prisma Studio
- `pnpm prisma migrate dev --create-only` to create a new migration without applying it

### Worktree Databases

Run `pnpm worktree:setup` from a linked worktree's root. The Codex environment runs this automatically. Setup copies missing local environment files from the primary checkout, installs dependencies, and generates Prisma. When the primary checkout's database URL points to a loopback PostgreSQL server containing `zoonk`, it also creates:

| Database             | Initial content                                     |
| -------------------- | --------------------------------------------------- |
| `zoonk_wt_<id>_dev`  | A consistent snapshot of the local `zoonk` database |
| `zoonk_wt_<id>_test` | This worktree's migrations and regular seed data    |
| `zoonk_wt_<id>_e2e`  | This worktree's migrations and regular seed data    |

The ID comes from the worktree's absolute path, so branches can be renamed without losing their database. Test databases contain seeded users, organizations, and progress; they do not copy development content. Setup runs the development copy alongside dependency installation and runs independent migrations and seeds in parallel. It prints its elapsed time when all three databases are ready.

Use Node.js 24 with PostgreSQL 18's `psql`, `pg_dump`, and `pg_restore` on `PATH`. On Windows, add PostgreSQL's `bin` directory to `PATH`; when using WSL, install and run these tools inside WSL. The local connection role needs permission to create databases and read the source. An unreachable local PostgreSQL server fails setup with a connection error; start it and rerun setup. Remote source URLs and missing source databases skip isolation. The primary checkout keeps its existing databases.

Setup writes development URLs into this worktree's app/package environment files, plus ignored `packages/db/.env.test.local` and `.env.e2e.local` overrides. Vitest, Prisma test commands, Playwright, and E2E builds read the same overrides. CI continues to use its configured URLs. Do not manually change the tracked `.env.test` or `.env.e2e` defaults. Keep using the regular commands, including `pnpm --filter @zoonk/db db:migrate --name <name>`.

Rerunning setup preserves ready databases and existing secrets. It repairs unfinished database initialization without replacing ready worktree data. If an expired database has been removed, rerun setup to recreate it. Setup prevents simultaneous attempts for the same worktree; if one is already running, let it finish before retrying. Different worktrees can initialize independently.

Each setup also checks databases managed by this mechanism for the same source. A database can be deleted only after its activity counters remain unchanged for at least seven days. New sessions, transactions, writes, statistics resets, and server restarts extend retention. Because PostgreSQL does not expose a database-wide last-write timestamp, cleanup conservatively starts a new seven-day interval when it observes changed counters. It never forces disconnections, deletes the current worktree's databases, or deletes legacy/manual databases without its ownership metadata. Cleanup runs when setup runs, so expiration is opportunistic.

## Structure

- `src/prisma/schema.prisma`: The main Prisma schema file with the `datasource` and `generator` definitions
- `src/prisma/models`: Contains all Prisma model files
- `src/prisma/migrations`: Contains all migrations
- `src/index.ts`: Our Prisma client instance to use in our apps
- `src/generated`: Contains the generated Prisma client, never edit this folder manually. Run `pnpm db:generate` to regenerate.
