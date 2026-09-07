---
name: zoonk-testing
description: Design, add, or debug Zoonk E2E, database integration, and pure-function tests.
license: MIT
metadata:
  author: zoonk
  version: "2.0.0"
---

# Zoonk testing

Choose the smallest test boundary that proves the changed product behavior. Follow the root verification policy for scope, completion, and reruns; do not turn every edit into a full-suite exercise.

For behavior changes, prefer a failing regression test before implementation when practical. Confirm it fails for the expected reason. If it already passes, investigate whether the defect is reproduced and whether the assertion distinguishes the intended outcome; do not weaken assertions or manufacture a failure.

## Choose coverage

| Behavior                                                          | Boundary                               | Guidance to load                                                                      |
| ----------------------------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------- |
| User flow, browser interaction, or public HTTP endpoint           | Playwright against real product routes | [E2E](references/e2e.md)                                                              |
| Persistence, permissions, transactions, or business orchestration | Vitest with the real test database     | [Database integration](references/integration.md)                                     |
| Non-trivial pure transformation or domain rule                    | Vitest beside the owning code          | Exercise the exported behavior with meaningful inputs; no additional reference needed |
| Native behavior                                                   | The app's native test tools            | Read the owning app's AGENTS.md                                                       |

Do not write React component unit tests or add tests for `admin`, `evals`, or `blog`. Do not test static configuration against itself, CSS, copy, prompt wording, Zod internals, or framework behavior. Do not export implementation details solely to test them.

## Data and external boundaries

- Create unique records through existing `*Fixture()` helpers. Tests that mutate user state need a unique user per test; a fresh browser context does not isolate database state.
- Keep shared seeded data read-only. It may serve as a guaranteed structural dependency or a route smoke test, but content assertions and mutations need test-owned records.
- Parallelize independent fixture creation. Tests must work in any order; release contexts and other owned resources, and clean up test-owned state when isolation requires it.
- Do not mock Prisma, `@zoonk/db`, repositories, or other persistence APIs for data behavior. Mock only an unavoidable external/platform boundary or a failure that cannot safely be produced with the real dependency, and explain why beside the mock.

## Running tests

Use the owning package's scripts and configured test database; do not substitute a development or production database. Confirm any setup/reset command targets the intended disposable database before running it. Relevant local test runs and repairs are part of the authorized implementation work.

Run the affected tests, then broaden only for affected consumers or unresolved risks. Investigate intermittent failures rather than hiding them with retries, forced interactions, weaker assertions, or larger timeouts. Repeat focused coverage for timing, concurrency, fixture isolation, or a reproduced flaky failure; an arbitrary five-run loop is not a completion requirement.

For Vitest, a package-scoped command is `mise x -- pnpm --filter <workspace> test <test-file>`. E2E build and launch details are in the E2E reference. Report checks accurately, including failures and anything not exercised.
