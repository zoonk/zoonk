# Checks for a change

Which checks to run before a commit and before a PR is marked ready. CI is the full gate: every push to a PR runs every Vitest and E2E suite and all the quality checks on GitHub's machines, so agents run locally only what the change needs, on the machine they share.

- **While you work:** the narrowest check that proves the step, such as the one regression test you're making pass.
- **Before each commit, and on the final tree before a PR is marked ready:** the change's rows below, once, after fixing everything the last round found, so a slow check doesn't run again for edits you could have batched. Report the checks and their results.
- **A failing check is investigated and fixed, never rerun until green,** an intermittent one included. A failure the change didn't cause gets its own thread ([out-of-task finds](../../AGENTS.md#scope-and-completion)).
- Scope the checks to the behavior and contracts the change touches, including consumers and tests in files it didn't edit. When its reach is broad or unclear, run the containing suites.
- Repeat a passing check only for a later change it covers. For a timing, concurrency or fixture-isolation change, repeat the focused test to show it's stable.

Run commands from the repository root with the Node.js and pnpm versions in `.tool-versions` (with mise, prefix `mise x --` when your shell doesn't activate it).

| Change                            | Checks                                                                                                                                 |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Markdown or instruction files     | `pnpm exec oxfmt --check <files>`, `pnpm agent-rules:check` (sizes, links and anchors), `git diff --check`                             |
| TypeScript behavior               | Focused `pnpm --filter <workspace> test <file>`, `pnpm --filter <workspace> typecheck`, `pnpm format <files>` then `pnpm lint <files>` |
| Module boundaries or dependencies | `pnpm knip` and `pnpm knip --production`                                                                                               |
| App runtime or build integration  | `pnpm --filter <app> build`; in a checkout with no `.env` files, prefix `VERCEL_ENV=development`, as `pnpm start` does                 |
| E2E flows                         | Focused `pnpm e2e:main <file>` or `pnpm e2e:api <file>` for the flows you changed                                                      |
| Android app                       | `pnpm android:check` and `make -C apps/android lint build`                                                                             |
| Apple app                         | [Apple verification](../../apps/apple/AGENTS.md#verification) covers the local Mac units and iPhone checks for device-specific changes |
| Prisma schema                     | `pnpm db:generate`, generated migration, affected database tests                                                                       |
| Public API contract               | `pnpm openapi:generate`, `pnpm openapi:check`, affected HTTP tests                                                                     |
| Next.js or Turborepo version      | `pnpm agent-rules:sync`, which updates the blocks they write into `AGENTS.md`                                                          |
| Translated copy                   | Affected app extraction, `i18n`, and `i18n:lint` ([translations](translations.md))                                                     |

Android's lint and release build run after merge or on demand (`gh workflow run android.yml --ref <branch>`), so run the Android row before its PR is marked ready.

Heavy commands take turns on a shared machine, and a busy one can run a branch's checks on GitHub instead ([sharing one machine](shared-machine.md)). How tests reach their databases is in [running tests locally](local-tests.md).
