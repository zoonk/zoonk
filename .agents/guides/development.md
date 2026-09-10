# Local development and verification commands

Read the relevant section when starting local services, signing in, or choosing validation commands. The root verification policy determines which checks the task needs.

## Commands

Run commands from the repository root using `mise x -- pnpm ...` in this environment. Read package scripts to select supported commands. These are a menu, not a checklist for every edit:

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

## Local development and sign-in

- In a new linked worktree, run `pnpm worktree:setup` before database-dependent work; Codex's environment hook already does this. Keep the generated local database overrides so migrations, integration tests, and E2E tests stay isolated. Rerun setup to restore expired databases.

- `pnpm dev` starts the apps and mailbox through clone- and worktree-scoped Portless routes. Use the URLs it prints. Use `pnpm dev:lan` for another device, `pnpm dev:direct` for direct ports, and `pnpm dev:prune` for orphaned servers. Stop active stacks from their original terminals.
- For local sign-in, use an account from `packages/db/src/prisma/seed/users.ts`, such as `owner@zoonk.test`, or a new `@zoonk.test` address. Request an OTP and read the newest message for that address in the local mailbox.
