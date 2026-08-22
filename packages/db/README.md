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

The content sync accepts only a local destination database named `zoonk`. It replaces the AI organization's courses, categories, chapters, lessons, vocabulary, sentences, pronunciations, resource links, and steps without importing source users or progress. Existing local prompt links, enrollments, completions, lesson progress, and attempts are mapped onto matching content in the replacement; the whole operation rolls back if any mapping is missing. Run the regular seed before the first sync to create the local AI organization, then run it afterward to initialize content-linked seed data on a new database.

#### Useful Commands

- `pnpm db:reset` to reset the database (this will erase all data)
- `pnpm db:studio` to open Prisma Studio
- `pnpm prisma migrate dev --create-only` to create a new migration without applying it

## Structure

- `src/prisma/schema.prisma`: The main Prisma schema file with the `datasource` and `generator` definitions
- `src/prisma/models`: Contains all Prisma model files
- `src/prisma/migrations`: Contains all migrations
- `src/index.ts`: Our Prisma client instance to use in our apps
- `src/generated`: Contains the generated Prisma client, never edit this folder manually. Run `pnpm db:generate` to regenerate.
