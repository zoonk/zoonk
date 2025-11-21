# Zoonk DB

This package contains all schemas and queries for interacting with our database. We're using [Prisma](https://www.prisma.io/) as our ORM.

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

#### Useful Commands

- `pnpm db:reset` to reset the database (this will erase all data)
- `pnpm db:studio` to open Prisma Studio
- `pnpm prisma migrate dev --create-only` to create a new migration without applying it

## Structure

- `prisma/schema.prisma`: The main Prisma schema file with the `datasource` and `generator` definitions.
- `prisma/models`: Contains all Prisma model files.
- `prisma/migrations`: Contains all migrations.
- `src/index.ts`: Our Prisma client instance to use in our apps.
- `src/models.ts`: Exported types and interfaces for our models.
- `src/queries`: Contains all database queries.
- `generated`: Contains the generated Prisma client, never edit this folder manually.
