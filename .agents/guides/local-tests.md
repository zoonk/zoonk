# Running tests locally

How Vitest and E2E runs reach their databases, and what breaks them. [Which checks a change needs](checks.md) is separate, and so is [what to test](../skills/zoonk-testing/SKILL.md).

## Vitest and its database

- Suites that use the database run on their own copy of the test database (`zoonk_test`, or the worktree's), made when the run starts and dropped when it ends; the next run drops copies a crashed run left.
- The test database itself is only the template: tests never write to it, `pnpm --filter @zoonk/db db:setup:test` migrates it (turbo's `test` task runs it first), and a migration edited in place needs its change and new checksum applied to it too. A run refuses a template whose migrations don't match the repository's.
- A timed-out test keeps running after Vitest moves on. In a shared worker it moves the clock, session mock and rows of whatever runs next, so core's and the API's setups skip every later test in that worker (`skipAfterTimeout`). Those skips are untested, not passed: fix the timed-out test, or rerun once the machine is less loaded, before trusting the run.

## E2E

- E2E runs in any checkout with its own E2E database: the primary checkout's `zoonk_e2e`, or a worktree's after `pnpm worktree:setup`.
- `pnpm e2e:main` and `pnpm e2e:api` migrate that database and build what they test, and pass any further arguments to Playwright (a test file, `--project`, `--grep`). Main's command also builds and starts the real API and a no-spend live-call provider, so specs that reach the API run as in CI; Main's Playwright run on its own has no API, and those specs fail.
- Run one E2E command per checkout at a time. The checkout's `pnpm dev` can keep running, since E2E builds and servers keep their own output and workflow store (`.next-e2e`).
- CI runs the same suites through turbo's cache (`pnpm turbo run e2e:suite --filter main`, `pnpm turbo run e2e --filter api`), so a push that leaves their inputs unchanged replays the last passing run; the local commands always run the tests. Main's CI builds both apps once, at fixed addresses, and each shard restores that build from turbo's cache.
- In a macOS sandbox, run browser-launching tests with escalated permissions on the first attempt, because Chromium needs Mach services. This is an execution permission, not a reason to stop for review.

## When a database or a build gets in the way

- When a branch replaces its migrations (a squash), `migrate deploy` stops on a worktree's own databases with P3018 ("type … already exists"). Reset the one that failed (`pnpm --filter @zoonk/db db:reset` for the `_dev` copy, `db:reset:test`, `db:reset:e2e`), never the primary checkout's `zoonk`; check the "Datasource" line names the worktree's copy first. Prisma refuses a reset an agent starts without the user's consent: ask, unless their own instructions already allow resetting these test-only databases.
- Building `apps/api` for production (`pnpm --filter api build`) clears the local workflow store at `apps/api/.next/workflow-data`, which a running API dev server from the same checkout uses: its in-flight workflow runs are lost.
