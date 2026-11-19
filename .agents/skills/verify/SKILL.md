---
name: verify
description: Verify finished work before calling it done, committing, or opening or updating a PR. Sizes the checks to the change, then routes to each step (automated checks, using the change in the running app, measuring pages, reviews, a learner walk, reading every touched screen) and says what evidence to report.
license: MIT
metadata:
  author: zoonk
  version: "2.0.0"
---

# Verify

Tests, types and lint prove what they exercise. What proves a change does what was meant is using it the way people will and measuring what can be measured. Run this loop whenever you finish work, before each commit, and before handing off: pick the steps the change needs, run them, fix what fails, run them again, and report the evidence. In Claude Code this skill replaces the built-in `/verify`.

A check is a lead, and a guard against a fault coming back. A pass says what was measured holds, not that the work is good: look at what you made either way ([designer's eye](../../../AGENTS.md#principles)).

## 1. Size it to the change

Read the whole diff since the work started, then take every row it touches. A one-line copy fix and a new route don't need the same pass; a typecheck alone verifies neither.

| The change touches                                                                                    | Verify with                                                                                                                                                                                                                                                                                                                                                           |
| ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Docs, instructions or skills only                                                                     | 2: format, links and sizes (`pnpm agent-rules:check`)                                                                                                                                                                                                                                                                                                                 |
| Logic, data, permissions or an API                                                                    | 2, 3 and 5: run it or call the endpoint                                                                                                                                                                                                                                                                                                                               |
| Copy, or a small visual tweak on one screen                                                           | 2, and 4 on that page at a phone and a laptop (`--viewports phone,laptop`), its [alignment](references/pages.md#alignment) passing                                                                                                                                                                                                                                    |
| Screens, layout, flows, waits, limits, errors, AI output learners read                                | 2 to 6, with pages measured on `pnpm start` on every screen, their [alignment](references/pages.md#alignment) passing and the screens' [scenarios](references/pages.md#scenarios) reached                                                                                                                                                                             |
| Data reads, routes, layouts, caching, Suspense, prefetching, client components, bundle or server cost | Also 4 throttled, with `--nav` and a `--baseline`                                                                                                                                                                                                                                                                                                                     |
| Effects, subscriptions, timers, long-lived client state, in-memory caches or workflows                | Also a memory soak (`--soak 10`)                                                                                                                                                                                                                                                                                                                                      |
| Entry points (actions, routes, API), auth, learner data, model calls, uploads or dependencies         | Also the [attack](references/attack.md) in 3 and the security review in 5, with `--intruder` on the pages that show that data                                                                                                                                                                                                                                         |
| The Apple or Android app                                                                              | 2, and 3 in the simulator or emulator from the app's `AGENTS.md`; for data loading, stores, navigation or long-lived state, also [measuring the Apple app](references/apple.md) or [the Android app](references/android.md); for a screen's layout, the [Apple](references/apple.md#layout-capture) or [Android](references/android.md#layout-capture) layout capture |
| Marking a PR ready for review, or merging                                                             | Everything above for the whole branch (`pnpm verify:diff --base <base branch>`, `pnpm audit --audit-level high`), plus 7 when a learner sees the change, and the [picture gate](../zoonk-commit/references/picture-gate.md)                                                                                                                                           |

## 2. Run the automated checks

Format, lint, typecheck and the affected tests for the change ([checks for a change](../../guides/checks.md)), then find the owner of every shared rule you touched and answer each item `pnpm verify:diff` lists: [automated checks](references/automated-checks.md).

## 3. Use the change in the running app

Passing checks don't show the change working. Run the app on `pnpm start` and do what the change is for: click the button, submit the form, finish the lesson, reload to see it saved, come back as the same learner. [Using the running app](references/running-app.md) covers the web, the API, the native apps, server errors and AI output. For each new or changed entry point, also [attack it](references/attack.md).

## 4. Measure the pages

`pnpm verify:pages <path...>`, on `pnpm start`, loads each path on a phone, tablets, a laptop, a desktop and a wide screen, in light and dark. It fails on errors, layout shift, blank frames, slow paints, blocking, sideways scrolling, accessibility, misaligned shared pieces and a learner's data reaching someone else, and lists leads to look at. [Measuring pages](references/pages.md) has the flags, each check's line and what usually fixes it.

- Before you change a page, save a run of it; afterwards pass that folder as `--baseline`.
- Narrow the run while you fix (`--viewports phone,laptop`), then run every screen once at the end.
- Fix a failure where it starts: an alignment failure in its shared piece, so every screen gets the fix.
- Open each page's contact sheets (`screens.png`, `paints.png`) whether the run passed or not, then a full screenshot where something looks off. A screen that passes and looks worse for a rule is a finding against the rule ([when a rule looks wrong](../../guides/exceptions.md)).
- On a busy machine the report marks timings inconclusive; counts and bytes still hold.

## 5. Review it as a principal engineer, a security researcher and a designer

You can't unsee how you built the change. For anything beyond a small fix, the reviews run once on the branch before the PR is marked ready, each in a separate agent that didn't write it, all at once, given the diff range, the running app's URL and its checklist ([models](../../guides/models.md)). Start only the roles the change needs:

- **[Principal engineer](references/review-engineer.md)** for code: failure paths, data and cost. This one comes from the other model family ([cross-model review](../../guides/cross-model-review.md)).
- **[Security researcher](references/security.md)** for the entry-points row in step 1: who else can reach the change and what it spends.
- **[Designer](references/review-designer.md)** for the screens row: what every screen looks like and how it's used.

Each tries to break the change and reports only what it can show or trace ([evidence before findings](../zoonk-code-review/SKILL.md#evidence-before-findings)). The builder fixes what they find.

## 6. Walk it as learners

For anything a learner can notice, use the product as contrasting personas, a bad day included, from entry to outcome and back the next day ([zoonk-persona-walkthrough](../zoonk-persona-walkthrough/SKILL.md)). Use the screen, don't only look at it: is it clear, quick, honest and recoverable, and is anything there that needn't be?

## 7. Capture and review every screen the branch touches

Faults get through in what nobody looked at: a size or a language nobody pictured, a state nothing reaches, a screen that imports a changed piece and was never reopened. So before a PR that changes what a learner sees, every screen the branch touches is pictured and read once by eyes that built none of it. Size it to the change: a copy fix covers the screens that show the string, and a shared piece covers every screen that imports it. [Screen coverage](references/screen-coverage.md) has the steps.

## 8. Fix and run it again

Fix what fails within the change's scope, rerun the check that caught it, and once everything passes run the change's set once more, since fixes break other things. Never loosen a budget or skip a check to pass: a budget is a product decision, so propose a change to it with the evidence. A finding you leave (a client fetch that has to poll, a shift you can't remove yet) is named in the report with the reason.

## 9. Report the evidence

Say what you ran and what it returned, so nobody has to run it again:

- each check's command and result (counts, failures with their output), and your answer to every `verify:diff` item
- shared-rule searches: the owner, the consumers moved, and what stays separate and why
- what you did in the running app, with screenshot paths, and what each attack sent and caused
- the `verify:pages` report path, its failures and what you changed for them, and the key numbers (before and after for speed work)
- each review's findings and what you did about them, and the persona walk in that skill's format
- for screen coverage: the screens pictured at which sizes and languages, the rows you couldn't reach and why, the readers, each blocking cause with its fix, and the issues the rest went to
- every departure from a rule about looks, for the user to accept or overrule
- what you couldn't verify and why

"All checks pass" without the evidence isn't verification.

When a person (or you) catches the same fault on several screens, fix the instruction that asked for it first, then make the catch something the next agent finds: [grow the loop](references/grow-the-loop.md).
