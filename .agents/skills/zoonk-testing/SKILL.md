---
name: zoonk-testing
description: Design, add, or debug Zoonk E2E, lesson player browser, database integration, pure-function, and Apple and Android app tests.
license: MIT
metadata:
  author: zoonk
  version: "2.0.0"
---

# Zoonk testing

Choose the cheapest boundary that exercises the behavior under investigation. Scope, failing-first regressions, completion, and reruns follow the [root verification policy](../../../AGENTS.md#verification).

## Choose coverage

| Behavior                                                                                                                                                                                                                                            | Boundary                                                           | Guidance to load                                                                                                                                                                                                                                                                                                                                                  |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A high-risk journey or seam only the running app shows ([the E2E bar](#the-e2e-bar)), or the public HTTP contract                                                                                                                                   | Playwright against real product routes                             | [E2E](references/e2e.md)                                                                                                                                                                                                                                                                                                                                          |
| Lesson player behavior: a lesson's screens, answers and feedback                                                                                                                                                                                    | Vitest browser mode in `packages/player`                           | Play whole lessons with `renderLessonPlayer` in `packages/player/src/_browser-tests/`, faking only the adapters' server calls. Every app reuses the player, so its behavior is tested there once, not in each app's E2E                                                                                                                                           |
| Persistence, permissions, transactions, or business orchestration                                                                                                                                                                                   | Vitest with the real test database                                 | [Database integration](references/integration.md)                                                                                                                                                                                                                                                                                                                 |
| Non-trivial pure transformation or domain rule                                                                                                                                                                                                      | Vitest beside the owning code                                      | Exercise the exported behavior with meaningful inputs. When its inputs vary widely (numbers, text, dates, markup it parses), also state what holds for every input as a fast-check property, such as reading back what it writes or never throwing, over inputs the product can see, like numbers a learner types (`packages/utils/src/localized-number.test.ts`) |
| Apple or Android app behavior that clears [the native bar](#the-native-bar)                                                                                                                                                                         | The app's unit tests; UI and device tests only for the smoke layer | Read the owning app's AGENTS.md                                                                                                                                                                                                                                                                                                                                   |
| A repository script whose failure is silent or reaches production: a check or gate that passes or fails a change (`scripts/verify`, `scripts/perf`), a deploy, a fake standing in for a provider, or a step that removes, resets or stops something | Vitest beside the script                                           | A broken check passes everything, and a broken deploy or cleanup is found after the damage. A script that fails where whoever runs it sees, such as `pnpm pr:capture`, gets no test: its next run is the test                                                                                                                                                     |

## The E2E bar

E2E is our most expensive test: a build, a browser, servers, a database and seeded learners for every test, on every push, and it breaks whenever the product changes. A Playwright test earns its place only by guarding a risk:

- **Impact:** if this broke and no test caught it, would it be a big deal for learners? Big deals: a learner can't sign in, get from a goal to a plan, open Today, start or finish a session, lesson or mock, make a call, ask the buddy or subscribe; loses progress, answers or data; is charged wrongly or loses paid access; sees someone else's data or hits a security hole; or AI spend starts without their click.
- **Likelihood:** how often does this kind of thing break? Complex, stateful or concurrent code that changes often (saving answers and progress, sessions, plan changes, entitlements and limits, auth, AI-run waits, live calls) and the server/client seams break; static rendering and simple conditional copy rarely do.
- **Cheaper coverage:** a rule that core's real-database tests, the player's browser tests or the API suite can check belongs there.

Failure paths count as much as happy paths: a lost answer on a bad connection can matter more than the screen that shows it. These don't earn an E2E test: wording and which notice shows, layout and sizes, accessibility scans, SEO (metadata, structured data, sitemaps), analytics events, speed-only checks (prefetching, no skeleton) and keyboard or focus niceties. A bug in one of those gets fixed and checked in the persona walkthrough and the [verify skill](../verify/SKILL.md)'s page measurements, without a permanent test. The `instant()` test the Next.js optimizer skills ask for proves an optimization while you make it; it ships as a permanent test only when that route clears this bar.

An `instant()` test guards the chosen prefetched UI under the network lock, not a blanket ban on skeletons. Preserve Today's learner-day and Start-button contract. Hard loads and incomplete or absent prefetches may show skeletons: the static shell must respond immediately while content streams. Check blank screens, slow paints and frozen taps in production page measurements and filmstrips.

Do not write React component unit tests or add tests for `admin`, `evals`, or `blog`. Do not test static configuration against itself, CSS, copy, prompt wording, Zod internals, or framework behavior. Do not export implementation details solely to test them.

## The native bar

A screen test in the Apple or Android app breaks whenever the screen's copy or layout changes, while the bugs it would pin turn up in reviews, parity audits and walks on a device. A native test earns its place only by guarding a risk that would hurt a learner and that a check on a device can't see, or can't practically see. Weigh impact, likelihood and cheaper coverage as for E2E, with failure paths counting as much as happy ones. In doubt, cut a screen test and keep a data-layer or race test. A test written to reproduce a bug ships only when it clears this bar.

Worth a test:

- **The shared data layer:** resources and keyed caches, mutations and queued saves, session identity (signing out on unauthorized, dropping a response whose session ended), generation streams and their resume, request counts, private image loading and API error mapping.
- **State machines and races the app owns:** transitions driven by a write, a failure, a session change or responses out of order, such as a purchase, the lesson player's state, a live call or a mock run.
- **Native-only logic:** layout math our code computes (pane splits and fold geometry, checked on the values it returns, not on where a screen's parts land), formatting it does itself (dates, numbers, durations, plurals across locales), parsing and transforms (rich text, sandbox output, chart and music data), and regexes on the device's engine.
- **What the learner made:** answers, drafts, progress or recordings kept across recreation, rotation, folding, process death or a failed save.
- **A thin smoke layer:** a few Apple UI tests (the accessibility audit across the tabs and Statistics, recovery from auth loss on a pushed screen, and a free account reaching the subscription store) and Android device tests only for what the JVM can't run.
- **Checks fed by the source of truth:** tests that fail when fixtures exported from main or core drift, contract tests for hand-written wire models, and the Android lint-check detectors.

Not worth one:

- Screen tests of copy, labels, which notice shows, TalkBack or VoiceOver strings, icons, colors, sizes, pane or fold placement, scroll position, what's expanded or where a tap leads.
- A rule core or the API decides (day state, plan rules, scoring, limits, eligibility) when the app only shows the answer.
- Hand-written JSON fed to the generated API client, which is the contract.
- Framework behavior, static catalogs, config or analytics event names.
- A second test of what another already guards; keep the cheaper.

A wording, layout or styling fix is checked on the device and in on-demand renders, without a permanent test. Android's renders (`-Pzoonk.shots`) skip in the suite and are a review tool, never goldens.

## Data and external boundaries

- Create unique records through existing `*Fixture()` helpers. Tests that mutate user state need a unique user per test; a fresh browser context does not isolate database state.
- Keep shared seeded data read-only. It may serve as a guaranteed structural dependency or a route smoke test, but content assertions and mutations need test-owned records.
- Parallelize independent fixture creation. Tests must work in any order; release contexts and other owned resources, and clean up test-owned state when isolation requires it.
- Do not mock Prisma, `@zoonk/db`, repositories, or other persistence APIs for data behavior. Mock only an unavoidable external/platform boundary or a failure that cannot safely be produced with the real dependency, and explain why beside the mock.

## Running tests

Use the owning package's scripts and isolated database from the [development guide](../../guides/development.md). Vitest files in one run still share rows; a fresh run does not replace test-owned fixtures. Confirm setup/reset commands target the intended disposable database.

A timed-out test keeps running after Vitest moves on. In a shared worker it moves the clock, session mock and rows of whatever runs next, later files included, so core's and the API's setups skip every later test in that worker (`skipAfterTimeout`). Those skips are untested, not passed: fix the timed-out test, or rerun once the machine is less loaded, before trusting the run.

Keep each E2E test well under 20 seconds locally: CI splits work by test, so one long test sets its shard's time. Test only what the assertion needs (a database simulation names its asserted `rules`; use fake timers, not real waits).

E2E-specific launch and waiting rules are in the [E2E reference](references/e2e.md).
