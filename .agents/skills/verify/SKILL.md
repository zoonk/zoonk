---
name: verify
description: Verify finished work before calling it done, committing, or opening or updating a PR. Size the checks to the change, run its automated checks, use the change in the running app, measure its pages on every screen size (speed, layout shift, skeletons, flashes, client data fetching, POSTs nobody clicked for, errors, overflow, accessibility, prefetching), judge rendering and design, walk it as learners, fix and recheck, and report the evidence.
license: MIT
metadata:
  author: zoonk
  version: "1.0.0"
---

# Verify

Tests, types and lint prove what they exercise. What proves a change does what was meant is using it the way people will and measuring what can be measured. Run this loop whenever you finish work, before each commit, and before handing off: pick the checks the change needs, run them, fix what fails, run them again, and report the evidence. Claude Code runs this skill before each commit (it replaces its built-in `/verify`); other agents reach it from the root `AGENTS.md`.

## 1. Size it to the change

Read the whole diff since the work started, then take every row it touches. A one-line copy fix and a new route don't need the same pass; a typecheck alone verifies neither.

| The change touches                                                                                    | Verify with                                                                                     |
| ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Docs, instructions or skills only                                                                     | 2: format, links and frontmatter                                                                |
| Logic, data, permissions or an API                                                                    | 2 and 3: run it or call the endpoint                                                            |
| Anything a learner sees or feels: screens, copy, flows, waits, limits, errors, AI output they read    | 2 to 6, with pages measured on `pnpm dev`                                                       |
| Data reads, routes, layouts, caching, Suspense, prefetching, client components, bundle or server cost | Also 4 on a production build (`pnpm start`), throttled, with `--nav`                            |
| The Apple or Android app                                                                              | 2, and 3 in the simulator or emulator from the app's `AGENTS.md`                                |
| Opening a PR, marking it ready, or merging                                                            | Everything above, plus the root [PR verification gate](../../../AGENTS.md#pr-verification-gate) |

## 2. Run the automated checks

Use the [development guide](../../guides/development.md)'s table for the change's checks before a commit: format and lint the touched files (lint after format), typecheck, the affected tests, and the containing suites when the impact is broad. Before a PR, run the full gate the root `AGENTS.md` describes, reading `.github/workflows` for the commands. A check that fails is investigated and fixed, never rerun until green.

## 3. Use the change in the running app

Passing checks don't show the change working. Run the app and do what the change is for: click the button, submit the form, finish the lesson, reload to see it saved, come back as the same learner.

- **Web:** `pnpm dev` serves this checkout at the URLs it prints. Sign in as a seeded persona or your own copy (`pnpm dev:persona`, [development guide](../../guides/development.md#persona-passes)) with the newest code in the dev mailbox. Drive the browser with whatever you have (Playwright, `agent-browser`, a browser extension or the harness's preview) and keep screenshots of the result.
- **Server errors:** with the page open in a browser, the dev server reports what went wrong on both sides: `curl -s -X POST <main URL>/_next/mcp -H 'content-type: application/json' -H 'accept: application/json, text/event-stream' -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"get_errors","arguments":{}}}' | sed -n 's/^data: //p'`. [next-dev-loop](../next-dev-loop/SKILL.md) lists its other tools (routes, compile issues, logs).
- **Production:** stop the checkout's `pnpm dev`, then `pnpm start` builds every app and serves the production builds at the same URLs, sign-in and mailbox included ([development guide](../../guides/development.md)).
- **API:** call the endpoint as a learner (persona bearer token, development guide) and read the response against the OpenAPI contract.
- **Native:** `pnpm iphone`, `pnpm ipad`, `pnpm android:phone` or `pnpm android:tablet`; tap through the screens.
- **AI:** nothing calls a model until a learner clicks. Prefer fixtures and seeded personas; when the change depends on what a model writes, walk one real run, keep it small, and say what it cost.

## 4. Measure the pages

`pnpm verify:pages <path...>` loads each path fresh on a phone, tablets in portrait and landscape, a laptop, a desktop and a wide screen, in light and dark. It fails on errors, layout shift past Core Web Vitals' line, skeletons, slow paints, server CPU, sideways scrolling and accessibility. It lists what to look at: POSTs and Server Actions nobody clicked for, client data fetches, any shift, late changes, unprefetched links and slow navigations. It saves full-page screenshots and every load's paint frames. Read [measuring pages](references/pages.md) for the flags, each check's line and what usually fixes it.

- On `pnpm dev`, it judges correctness and layout. Speed, skeletons, late changes and prefetching are judged only on a production build: run it again on `pnpm start` with `--throttle` and, for pages a learner moves between, `--nav`.
- Narrow the run while you fix (`--viewports phone,laptop`), then run every screen once at the end.
- Look at each page's contact sheets first (`screens.png`: every screen in each scheme; `paints.png`: every paint of each load), then open a full screenshot or frame where something looks off. A change to speed or server cost reports the numbers before and after on the same setup.

## 5. Judge rendering and design

- **Server first.** Data a page shows is read on the server (Server Components through `@zoonk/core`, cached per the [core contract](../../../packages/core/AGENTS.md)) and arrives with the page, not fetched in an effect after it paints. Client components hold interaction state, not data loading. Look in the diff for `useEffect` that fetches, client `fetch` or polling for data the server had, `"use client"` high in a page's tree, and new Suspense fallbacks or `loading.tsx` on everyday pages; [React best practices](../vercel-react-best-practices/SKILL.md) covers the patterns.
- **No flashes.** A page appears once, complete: no skeleton swapped for content, no content swapped for other content, no theme or font flash, nothing that jumps. The frames and the CLS sources show where.
- **Design.** Hold the screenshots to [zoonk-design](../zoonk-design/SKILL.md)'s taste bar: hierarchy, edges, type, color meaning, sibling consistency. `verify:pages` covers every size and scheme of the pages you name; the states (empty, error, long Portuguese and German words, keyboard focus) are yours to pick from what the change reaches, and you check those by hand at a phone and a laptop size. Motion follows [zoonk-motion](../zoonk-motion/SKILL.md).

## 6. Walk it as learners

For anything a learner can notice, use the product as two to four contrasting personas with [zoonk-persona-walkthrough](../zoonk-persona-walkthrough/SKILL.md), including a bad day, from entry to outcome and back the next day. Use the screen, don't only look at it: is it clear, quick, honest and recoverable, and is anything there that needn't be? For substantial changes a separate agent walks with only the persona brief and the URL, so it doesn't know how the change works.

## 7. Fix and run it again

Fix what fails within the change's scope, rerun the check that caught it, and once everything passes run the change's set once more, since fixes break other things. Never loosen a budget or skip a check to pass: a budget is a product decision, so propose a change to it with the evidence. A finding you leave (a client fetch that has to poll, a shift you can't remove yet) is named in the report with the reason.

## 8. Report the evidence

Say what you ran and what it returned, so nobody has to run it again:

- each check's command and result (counts, failures with their output)
- what you did in the running app, with screenshot paths
- the `verify:pages` report path, its failures and what you changed for them, and the key numbers (before and after for speed work)
- the persona walk, in that skill's format
- what you couldn't verify and why

"All checks pass" without the evidence isn't verification.

## Grow the loop

When a person (or you) catches something by checking by hand, make it something the next agent measures: a check in `scripts/verify/checks.mts` with its unit test, a measurement in `scripts/verify/measure.mts`, or a step in this skill. Prefer checks with a number and a line over judgment calls; an agent can tell whether a number passed.
