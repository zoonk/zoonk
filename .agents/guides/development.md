# Local development and verification commands

Read the relevant section when starting local services, signing in, or choosing validation commands. The root verification policy determines which checks the task needs.

## Commands

Run commands from the repository root using `mise x -- pnpm ...` in this environment. Read package scripts to select supported commands. Commits require the change's relevant checks and reported results. Before opening a PR (including a draft), marking it ready for review, or merging it, the [root PR verification gate](../../AGENTS.md#pr-verification-gate) requires the full PR and `main` CI quality checks:

| Change                            | Relevant checks                                                                                          |
| --------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Markdown or instruction files     | `pnpm exec oxfmt --check <files>`, links/frontmatter, `git diff --check`                                 |
| TypeScript behavior               | Focused `pnpm --filter <workspace> test <file>`, `pnpm --filter <workspace> typecheck`, root `pnpm lint` |
| Module boundaries or dependencies | `pnpm knip --production`                                                                                 |
| App runtime or build integration  | `pnpm --filter <app> build`                                                                              |
| E2E flows                         | Focused `pnpm e2e:main <file>` or `pnpm e2e:api <file>`; both suites with `pnpm e2e`                     |
| Prisma schema                     | `pnpm db:generate`, generated migration, affected database tests                                         |
| Public API contract               | `pnpm openapi:generate`, `pnpm openapi:check`, affected HTTP tests                                       |
| Translated copy                   | Affected app extraction, `i18n`, and `i18n:lint`                                                         |

- Vitest suites that use the database run on their own copy of the test database (`zoonk_test`, or the worktree's), made when the run starts and dropped when it ends; the next run drops copies a crashed run left. The test database itself is only the template: tests never write to it, `pnpm --filter @zoonk/db db:setup:test` migrates it (turbo's `test` task runs it first), and a migration edited in place needs its change and new checksum applied to it too. A run refuses a template whose migrations don't match the repository's.
- In a macOS sandbox, run browser-launching tests with escalated permissions on the first attempt because Chromium needs Mach services. This is an execution permission requirement, not a request to stop implementation for local review.
- E2E runs in any checkout with its own E2E database: the primary checkout's `zoonk_e2e`, or a worktree's after `pnpm worktree:setup`. `pnpm e2e:main` and `pnpm e2e:api` migrate that database and build what they test, and pass any further arguments to Playwright (a test file, `--project`, `--grep`). Main's command also builds and starts the real API and a no-spend live-call provider, so specs that reach the API run as in CI; Main's Playwright run on its own has no API, and those specs fail. Run one E2E command per checkout at a time; the checkout's `pnpm dev` can keep running, since E2E builds and servers keep their own output and workflow store (`.next-e2e`). CI runs the same suites through turbo's cache (`pnpm turbo run e2e:suite --filter main`, `pnpm turbo run e2e --filter api`), so a push that leaves their inputs unchanged replays the last passing run; the local commands always run the tests.
- Building `apps/api` for production (`pnpm --filter api build`) clears the local workflow store at `apps/api/.next/workflow-data`, which a running API dev server from the same checkout uses: its in-flight workflow runs are lost.

## Local development and sign-in

- In a new linked worktree, run `pnpm worktree:setup` before database-dependent work; worktrees that Codex, Claude Code, or T3 Code with the imported `t3.json` Setup action create already ran it. Keep the generated local database overrides so migrations, integration tests, and E2E tests stay isolated. Rerun setup to restore expired databases.

- `pnpm dev` starts the apps and mailbox through clone- and worktree-scoped Portless routes. Use the URLs it prints. Use `pnpm dev:lan` for another device, `pnpm dev:direct` for direct ports, and `pnpm dev:prune` for orphaned servers. A stack's services stop by themselves within seconds of its `pnpm dev` or `pnpm start` ending, even when that process is force-killed, so stopping the command stops the whole stack.
- `pnpm start` builds every app for those same routes and serves the production builds, so sign-in and the mailbox work as in `pnpm dev`. Stop the checkout's `pnpm dev` first: both register the same routes. Each app's `start:app` is the bare `next start`, which E2E servers run on their own ports; outside `pnpm start` and E2E, a production build counts as a deployment, so local sign-in refuses it.
- Verify, review and walk personas on `pnpm start`: the production build is what learners get, while a dev server compiles on demand and shows loading states they never see. Use `pnpm dev` only while you change UI and want hot reload, then stop it and check the result on `pnpm start`. With agents working in parallel this also saves memory: an idle dev stack holds about 8 GB (Main alone about 5 GB after a few dozen pages), a production one about 2.5 GB. Stop the server when you're done.
- For local sign-in, use an account from `packages/db/src/prisma/seed/users.ts`, such as `owner@zoonk.test`, or a new `@zoonk.test` address. Request an OTP and read the newest message for that address in the local mailbox.

## Persona passes

- Put a seeded persona on any day of its plan with `pnpm dev:persona <name> [--day <n>] [--away <days>] [--plus|--free] [--tz <zone>] [--locale en|pt]`. It writes a private copy to the local development database without calling a model and prints how to sign in; the [persona catalog](../skills/zoonk-persona-walkthrough/references/personas.md) explains the options.
- Walk an onboarding once as `onboarded-<name>@zoonk.test`, then copy that learner for every later pass with `pnpm dev:persona --from onboarded-<name>@zoonk.test [--day <n> | --away <days>] [--plus|--free] [--tz <zone>]`, which writes a private copy the same way.
- Keep the shared Library between passes: once no workflow is running, `pnpm dev:remove-test-learners` lists every learner the seed didn't write except `onboarded-` ones, and `--yes` removes them through account deletion. Shared courses, lessons, skills and exam content stay, so the next pass doesn't pay to generate them again. It only runs against the local development database.
- Reset the database and reseed it only when migrations change the schema; a reset throws away the shared Library.
- To cover the cold path, run one persona per pass on a goal no earlier pass used.
