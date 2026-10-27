---
name: verify
description: Verify finished work before calling it done, committing, or opening or updating a PR. Size the checks to the change, run its automated checks and the diff audit, use the change in the running app, measure its pages on every screen size (speed, blocking time, layout shift, skeletons, flashes, memory, client data fetching, data exposure, errors, overflow, accessibility, prefetching), review it as a principal engineer, a security researcher and a designer, walk it as learners, fix and recheck, and report the evidence.
license: MIT
metadata:
  author: zoonk
  version: "1.0.0"
---

# Verify

Tests, types and lint prove what they exercise. What proves a change does what was meant is using it the way people will and measuring what can be measured. Run this loop whenever you finish work, before each commit, and before handing off: pick the checks the change needs, run them, fix what fails, run them again, and report the evidence. Claude Code runs this skill before each commit (it replaces its built-in `/verify`); other agents reach it from the root `AGENTS.md`.

## 1. Size it to the change

Read the whole diff since the work started, then take every row it touches. A one-line copy fix and a new route don't need the same pass; a typecheck alone verifies neither.

| The change touches                                                                                    | Verify with                                                                                                                                                                                     |
| ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Docs, instructions or skills only                                                                     | 2: format, links and frontmatter                                                                                                                                                                |
| Logic, data, permissions or an API                                                                    | 2, 3 and 5: run it or call the endpoint                                                                                                                                                         |
| Copy, or a small visual tweak on one screen                                                           | 2, and 4 on that page at a phone and a laptop (`--viewports phone,laptop`)                                                                                                                      |
| Screens, layout, flows, waits, limits, errors, AI output learners read                                | 2 to 6, with pages measured on `pnpm dev` on every screen                                                                                                                                       |
| Data reads, routes, layouts, caching, Suspense, prefetching, client components, bundle or server cost | Also 4 on a production build (`pnpm start`), throttled, with `--nav` and a `--baseline`                                                                                                         |
| Effects, subscriptions, timers, long-lived client state, in-memory caches or workflows                | Also a memory soak (`--soak 10`) on `pnpm start`                                                                                                                                                |
| Entry points (actions, routes, API), auth, learner data, model calls, uploads or dependencies         | Also the security review in 5, with `--intruder` on the pages that show that data                                                                                                               |
| The Apple or Android app                                                                              | 2, and 3 in the simulator or emulator from the app's `AGENTS.md`                                                                                                                                |
| Opening a PR, marking it ready, or merging                                                            | Everything above for the whole branch (`pnpm verify:diff --base <base branch>`, `pnpm audit --audit-level high`), plus the root [PR verification gate](../../../AGENTS.md#pr-verification-gate) |

## 2. Run the automated checks

Use the [development guide](../../guides/development.md)'s table for the change's checks before a commit: format and lint the touched files (lint after format), typecheck, the affected tests, and the containing suites when the impact is broad. Before a PR, run the full gate the root `AGENTS.md` describes, reading `.github/workflows` for the commands. A check that fails is investigated and fixed, never rerun until green.

Then `pnpm verify:diff` (`--base <ref>` for a branch) reads the change as a principal engineer, a security researcher and a designer would: every client component, effect, browser fetch, cache, migration, entry point, model call, raw HTML or SQL, public env value, dependency, raw color or `aria-label` it adds, each with the question to answer. Answer every item in your report, by fixing the code or saying why it's right; credentials, env files, focused tests and a vulnerable dependency the change adds block.

## 3. Use the change in the running app

Passing checks don't show the change working. Run the app and do what the change is for: click the button, submit the form, finish the lesson, reload to see it saved, come back as the same learner.

- **Web:** `pnpm dev` serves this checkout at the URLs it prints. Sign in as a seeded persona or your own copy (`pnpm dev:persona`, [development guide](../../guides/development.md#persona-passes)) with the newest code in the dev mailbox. Drive the browser with whatever you have (Playwright, `agent-browser`, a browser extension or the harness's preview) and keep screenshots of the result.
- **Server errors:** with the page open in a browser, the dev server reports what went wrong on both sides: `curl -s -X POST <main URL>/_next/mcp -H 'content-type: application/json' -H 'accept: application/json, text/event-stream' -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"get_errors","arguments":{}}}' | sed -n 's/^data: //p'`. [next-dev-loop](../next-dev-loop/SKILL.md) lists its other tools (routes, compile issues, logs).
- **Production:** stop the checkout's `pnpm dev`, then `pnpm start` builds every app and serves the production builds at the same URLs, sign-in and mailbox included ([development guide](../../guides/development.md)).
- **API:** call the endpoint as a learner (persona bearer token, development guide) and read the response against the OpenAPI contract.
- **Native:** `pnpm iphone`, `pnpm ipad`, `pnpm android:phone` or `pnpm android:tablet`; tap through the screens.
- **AI:** nothing calls a model until a learner clicks. Prefer fixtures and seeded personas; when the change depends on what a model writes, walk one real run, keep it small, and say what it cost.

## 4. Measure the pages

`pnpm verify:pages <path...>` loads each path fresh on a phone, tablets in portrait and landscape, a laptop, a desktop and a wide screen, in light and dark. It fails on errors, layout shift past Core Web Vitals' line, skeletons, slow paints, main-thread blocking, server CPU, sideways scrolling, accessibility and a signed-in learner's data reaching someone else. It lists what to look at: POSTs and Server Actions nobody clicked for, client data fetches, any shift, late changes, cut-off text, unprefetched links, slow navigations, memory that keeps growing and regressions against a baseline. It saves full-page screenshots and every load's paint frames. Read [measuring pages](references/pages.md) for the flags, each check's line and what usually fixes it.

- On `pnpm dev`, it judges correctness and layout. Speed, skeletons, late changes, prefetching, memory and regressions are judged only on a production build: run it again on `pnpm start` with `--throttle` and, for pages a learner moves between, `--nav`.
- Before you change a page, save a run of it; afterwards pass that run's folder as `--baseline` to see what got slower or heavier, and before and after side by side in the contact sheets.
- For data reads, start the server with `ZOONK_QUERY_LOG=$PWD/tmp/verify/queries.jsonl pnpm start` and pass `--queries tmp/verify/queries.jsonl`: each page's render lists its statements, flags reads repeated per item (N+1), results over 1,000 rows and filters no index serves.
- `--email` also opens every path signed out, and `--intruder <another learner>` as someone else: neither may receive the learner's email, account id or full name. `--soak 10` walks the paths ten times and compares memory after the first lap and the last.
- Narrow the run while you fix (`--viewports phone,laptop`), then run every screen once at the end.
- Timings measure the machine as much as the page when other work is running: past three runnable tasks per core, the report marks speed, memory and regressions inconclusive. Main-thread work, request and statement counts and bytes still hold; compare timings back to back on a quiet machine.
- Look at each page's contact sheets first (`screens.png`: every screen in each scheme; `paints.png`: every paint of each load), then open a full screenshot or frame where something looks off. A change to speed or server cost reports the numbers before and after on the same setup.

## 5. Review it as a principal engineer, a security researcher and a designer

Each role looks for what the others miss: the engineer for failure paths, data and cost; the security researcher for who else can reach the change and what it spends; the designer for what every screen looks like and how it's used. Their checklists say which of the tools above answers each question:

- [Principal engineer and designer](references/review.md)
- [Security researcher](references/security.md)

You can't unsee how you built the change. For anything beyond a small fix, each review runs in a separate agent that didn't write it, given the diff range, the running app's URL and its checklist, all at once ([orchestration guide](../../guides/orchestration.md) for the models). In Claude Code, `/code-review` and `/security-review` run in fresh subagents. The builder fixes what they find.

## 6. Walk it as learners

For anything a learner can notice, use the product as two to four contrasting personas with [zoonk-persona-walkthrough](../zoonk-persona-walkthrough/SKILL.md), including a bad day, from entry to outcome and back the next day. Use the screen, don't only look at it: is it clear, quick, honest and recoverable, and is anything there that needn't be? For substantial changes a separate agent walks with only the persona brief and the URL, so it doesn't know how the change works.

## 7. Fix and run it again

Fix what fails within the change's scope, rerun the check that caught it, and once everything passes run the change's set once more, since fixes break other things. Never loosen a budget or skip a check to pass: a budget is a product decision, so propose a change to it with the evidence. A finding you leave (a client fetch that has to poll, a shift you can't remove yet) is named in the report with the reason.

## 8. Report the evidence

Say what you ran and what it returned, so nobody has to run it again:

- each check's command and result (counts, failures with their output), and your answer to every `verify:diff` item
- what you did in the running app, with screenshot paths
- the `verify:pages` report path, its failures and what you changed for them, and the key numbers (before and after for speed work)
- each review's findings and what you did about them, and the persona walk in that skill's format
- what you couldn't verify and why

"All checks pass" without the evidence isn't verification.

## Grow the loop

When a person (or you) catches something by checking by hand, make it something the next agent measures: a rule in `scripts/verify/rules/`, a check in `scripts/verify/checks.mts`, a measurement in `scripts/verify/measure.mts` (each with its unit test), or a line in a reviewer's checklist. Prefer checks with a number and a line over judgment calls; an agent can tell whether a number passed.
