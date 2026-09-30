# Local development and verification commands

Read the relevant section when starting local services, signing in, or choosing validation commands. The root verification policy determines which checks the task needs.

## Commands

Run commands from the repository root using `mise x -- pnpm ...` in this environment, or plain `pnpm ...` in [Claude Code cloud sessions](#claude-code-cloud-sessions). Read package scripts to select supported commands. These are a menu, not a checklist for every edit:

| Change                            | Relevant checks                                                                                          |
| --------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Markdown or instruction files     | `pnpm exec oxfmt --check <files>`, links/frontmatter, `git diff --check`                                 |
| TypeScript behavior               | Focused `pnpm --filter <workspace> test <file>`, `pnpm --filter <workspace> typecheck`, root `pnpm lint` |
| Module boundaries or dependencies | `pnpm knip --production`                                                                                 |
| App runtime or build integration  | `pnpm --filter <app> build`                                                                              |
| E2E flows                         | `pnpm --filter <app> build:e2e`, then focused `pnpm --filter <app> e2e <file>`                           |
| Prisma schema                     | `pnpm db:generate`, generated migration, affected database tests                                         |
| Public API contract               | `pnpm openapi:generate`, `pnpm openapi:check`, affected HTTP tests                                       |
| Translated copy                   | Affected app extraction, `i18n`, and `i18n:lint`                                                         |

- In a macOS sandbox, run browser-launching tests with escalated permissions on the first attempt because Chromium needs Mach services. This is an execution permission requirement, not a request to stop implementation for local review.
- Building `apps/api` (`build`, `build:e2e`) clears the local workflow store at `apps/api/.next/workflow-data`, which a running API dev server from the same checkout uses: its in-flight workflow runs are lost. While one runs, give the build its own store, for example `WORKFLOW_TARGET_WORLD=local WORKFLOW_LOCAL_DATA_DIR=.next-e2e/workflow-data`, and pass the same variables to the E2E run that serves that build.

## Local development and sign-in

- In a new linked worktree, run `pnpm worktree:setup` before database-dependent work; Codex's environment hook already does this. Keep the generated local database overrides so migrations, integration tests, and E2E tests stay isolated. Rerun setup to restore expired databases.

- `pnpm dev` starts the apps and mailbox through clone- and worktree-scoped Portless routes. Use the URLs it prints. Use `pnpm dev:lan` for another device, `pnpm dev:direct` for direct ports, and `pnpm dev:prune` for orphaned servers. Stop active stacks from their original terminals.
- For local sign-in, use an account from `packages/db/src/prisma/seed/users.ts`, such as `owner@zoonk.test`, or a new `@zoonk.test` address. Request an OTP and read the newest message for that address in the local mailbox.

## Claude Code cloud sessions

- `.claude/hooks/session-start.sh` prepares each cloud session: Node and pnpm at the repo's versions on `PATH` (there is no `mise`), dependencies and the Prisma client, Postgres 18 on `localhost:5432` with `zoonk`, `zoonk_test` and `zoonk_e2e` migrated, each app's `.env` from its example, and a Chromium Playwright can launch. It logs to `/tmp/zoonk-session-start.log`. After checking out a branch with other migrations, rerun `pnpm --filter @zoonk/db db:setup:test` and `db:setup:e2e`, or their `db:reset:*` scripts.
- `pnpm --filter <app> i18n` translates with eloqnt's hosted engine when the environment sets `ELOQNT_TOKEN`; without it, it needs the Codex CLI, which cloud sessions lack.
- The environment's network access must allow `engine.eloqnt.dev` for translation. Allowing `cdn.playwright.dev` lets Playwright download its pinned Chromium instead of using the container's.
