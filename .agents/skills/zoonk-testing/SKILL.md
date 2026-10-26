---
name: zoonk-testing
description: Design, add, or debug Zoonk E2E, lesson player browser, database integration, and pure-function tests.
license: MIT
metadata:
  author: zoonk
  version: "2.0.0"
---

# Zoonk testing

Choose a test boundary capable of exercising the behavior under investigation. Choose the overall set of checks from the affected behavior and consumers. A small regression test may demonstrate one property while broader existing coverage remains necessary for the change. Follow the root verification policy for scope, completion, and reruns.

For behavior changes, prefer a failing regression test before implementation when practical, at the cheapest boundary that reproduces it; a regression that only E2E reproduces gets an E2E test only when it clears [the E2E bar](#the-e2e-bar). Confirm it fails for the expected reason. If it already passes, investigate whether the defect is reproduced and whether the assertion distinguishes the intended outcome; do not weaken assertions or manufacture a failure.

## Choose coverage

| Behavior                                                                                                          | Boundary                                 | Guidance to load                                                                                                                                                                                                        |
| ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A high-risk journey or seam only the running app shows ([the E2E bar](#the-e2e-bar)), or the public HTTP contract | Playwright against real product routes   | [E2E](references/e2e.md)                                                                                                                                                                                                |
| Lesson player behavior: a lesson's screens, answers and feedback                                                  | Vitest browser mode in `packages/player` | Play whole lessons with `renderLessonPlayer` in `packages/player/src/_browser-tests/`, faking only the adapters' server calls. Every app reuses the player, so its behavior is tested there once, not in each app's E2E |
| Persistence, permissions, transactions, or business orchestration                                                 | Vitest with the real test database       | [Database integration](references/integration.md)                                                                                                                                                                       |
| Non-trivial pure transformation or domain rule                                                                    | Vitest beside the owning code            | Exercise the exported behavior with meaningful inputs; no additional reference needed                                                                                                                                   |
| Planner behavior across a learner's life, against the owner's planning rules                                      | The learner simulator in `packages/core` | [Learner simulator](references/simulator.md)                                                                                                                                                                            |
| Native behavior                                                                                                   | The app's native test tools              | Read the owning app's AGENTS.md                                                                                                                                                                                         |

## The E2E bar

E2E is our most expensive test: a build, a browser, servers, a database and seeded learners for every test, on every push, and it breaks whenever the product changes. A Playwright test earns its place only by guarding a risk:

- **Impact:** if this broke and no test caught it, would it be a big deal for learners? Big deals: a learner can't sign in, get from a goal to a plan, open Today, start or finish a session, lesson or mock, make a call, ask the buddy or subscribe; loses progress, answers or data; is charged wrongly or loses paid access; sees someone else's data or hits a security hole; or AI spend starts without their click.
- **Likelihood:** how often does this kind of thing break? Complex, stateful or concurrent code that changes often (saving answers and progress, sessions, plan changes, entitlements and limits, auth, AI-run waits, live calls) and the server/client seams break; static rendering and simple conditional copy rarely do.
- **Cheaper coverage:** a rule that core's real-database tests, the player's browser tests or the API suite can check belongs there.

Failure paths count as much as happy paths: a lost answer on a bad connection can matter more than the screen that shows it. These don't earn an E2E test: wording and which notice shows, layout and sizes, accessibility scans, SEO (metadata, structured data, sitemaps), analytics events, speed-only checks (prefetching, no skeleton) and keyboard or focus niceties. A bug in one of those gets fixed and checked in the persona walkthrough, without a permanent test. The `instant()` test the Next.js optimizer skills ask for proves an optimization while you make it; it ships as a permanent test only when that route clears this bar.

Do not write React component unit tests or add tests for `admin`, `evals`, or `blog`. Do not test static configuration against itself, CSS, copy, prompt wording, Zod internals, or framework behavior. Do not export implementation details solely to test them.

## Data and external boundaries

- Create unique records through existing `*Fixture()` helpers. Tests that mutate user state need a unique user per test; a fresh browser context does not isolate database state.
- Keep shared seeded data read-only. It may serve as a guaranteed structural dependency or a route smoke test, but content assertions and mutations need test-owned records.
- Parallelize independent fixture creation. Tests must work in any order; release contexts and other owned resources, and clean up test-owned state when isolation requires it.
- Do not mock Prisma, `@zoonk/db`, repositories, or other persistence APIs for data behavior. Mock only an unavoidable external/platform boundary or a failure that cannot safely be produced with the real dependency, and explain why beside the mock.

## Running tests

Use the owning package's scripts and configured test database; do not substitute a development or production database. Each Vitest run tests on its own fresh copy of that database: earlier runs' rows never reach it, while the run's test files still share it. See the [development guide](../../guides/development.md) for the template it copies. Confirm any setup/reset command targets the intended disposable database before running it. Relevant local test runs and repairs are part of the authorized implementation work.

Run the affected tests, then broaden only for affected consumers or unresolved risks. Investigate intermittent failures rather than hiding them with retries, forced interactions, weaker assertions, or larger timeouts. Repeat focused coverage for timing, concurrency, fixture isolation, or a reproduced flaky failure; an arbitrary five-run loop is not a completion requirement.

Keep each E2E test well under 20 seconds locally: CI splits work by test, so one long test sets its shard's time. Test only what the assertion needs (a database simulation names its asserted `rules`; use fake timers, not real waits).

## Production read-shape ratchets

Database integration tests verify a fact's shape and authorization, but Vitest has no Next.js request `workStore` and cannot prove private-cache dedupe. Ratchet (a) measures exact-repeat physical SQL per production request: normalize the statement and hash its complete bound parameter array without logging values. Keep timestamp-varied groups separate; they can be intentional windows rather than duplicates.

Measure a production build (`build:e2e`, then `next start` on a high port) of the change's isolated worktree against its own E2E database, never a shared one. Reuse the same personas and routes for the baseline and each fact's cut on Today API, Plan, Buddy, Chapter and Mind maps. Record the source SHA and dirty patch, warm up once, then measure three repetitions. Compare each fact's SQL/parameter families with the baseline's; do not infer savings from static call-site counts or a zero-repeat total alone.

Pair repeat budgets with process CPU, returned rows, response bytes and process memory. For large facts, measure the internal Flight encoding and decoding cost and bytes separately; process RSS is not allocation attributable to one fact. Report clock, fixture, wrong-kind/not-found and unrun-path limits. Fresh write/workflow checks and private-source visibility guards remain part of acceptance. Ratchet (b), plan-build entries per GET, belongs to plan-compute; ratchet (c), action-induced requests and SQL, belongs to D6.

For Vitest, a package-scoped command is `mise x -- pnpm --filter <workspace> test <test-file>`. E2E build and launch details are in the E2E reference. Report checks accurately, including failures and anything not exercised.
