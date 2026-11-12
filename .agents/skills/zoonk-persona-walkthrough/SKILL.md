---
name: zoonk-persona-walkthrough
description: Use the running product as realistic learner personas, including their bad days, before calling a user-facing change done. Pick personas from the change's risks and what they don't know, put them in a realistic state cheaply, show each changed screen to an agent that sees only the screenshot, walk with fresh eyes, fix or push back, give a reproducible problem a regression test when zoonk-testing's bar calls for one, and report the evidence.
license: MIT
metadata:
  author: zoonk
  version: "1.1.0"
---

# Persona walkthrough

Automated tests prove what they exercise, and the person who built a feature fills gaps with knowledge a learner doesn't have. This walkthrough checks what a real learner gets: whether each screen is clear at a glance, in words they know, with nothing they wouldn't miss, and whether the experience is simple, true and recoverable, on the first day and on the days after it.

Use it for any change a learner can see or feel: screens, flows, copy, plan behavior, AI output they read, waits, limits and errors. For a change no learner can notice, say why you skipped it.

## 1. Pick personas from the change's risks

- Start from the [persona catalog](references/personas.md). Pick two to four personas who differ on what the change touches: goal type, plan tier, daily time, device, language, history.
- At least one must be off the happy path for this change: behind on the plan, free at a limit, back after a week away, changing their mind, on a small phone, using a screen reader.
- When an issue or feature has no persona that fits it well, add one to the catalog with the same fields, so later walks reuse it.

## 2. Put each persona in a realistic state, cheaply

- Prefer seeded personas and the persona command described in the catalog. They give a realistic learner at a chosen point of their plan with no AI cost.
- Use the real onboarding when the journey starts there. Keep the shared Library warm between passes (development guide, "Persona passes") so walks don't pay to generate content again.
- Seeded data can't show whether real AI output works. When the change depends on what a model writes, reads or grades, walk it at least once end to end with real AI output, and keep those runs few and small. Turn what you checked by eye into eval cases, so later changes are checked without paying for another walk.
- Use the persona's device size, time zone and language, in light and dark. On one of Xcode's own iPhone simulators, hold it for the whole walk, as the [Apple simulator rules](../../../apps/apple/AGENTS.md#simulators) say, so a test run doesn't take it.

## 3. Walk with fresh eyes

- Walk the production build `pnpm start` serves, not a dev server: it's what learners get, and a dev server adds compile waits and loading states they never see ([development guide](../../guides/development.md)).
- A builder can't unknow the implementation. For substantial changes, have a separate agent walk with only the persona brief, the journeys to cover and the app URL, without the diff, and report back; the builder fixes. When you walk your own work, write down what the persona knows before each screen and judge only from what the screen shows.
- Start with zoonk-design's [first-glance test](../zoonk-design/SKILL.md#the-first-glance-test) on every new or changed screen: an agent that has seen neither the code, the spec nor the brief gets one phone-size screenshot and says what the screen is for, what it would tap, and which words or lines it doesn't understand or wouldn't miss. For a marketing page the agent is a visitor from a search who has never heard of Zoonk, and the questions are that test's own. Do it before the walk, so the walker's first read is still a first read.
- Enter through the normal UI, reach the outcome, then come back: the next day, after a gap, on another device.
- Cover the unhappy paths in [journeys](references/journeys.md) for every surface the change reaches, not only the screen you edited.
- At each screen, ask as the persona:
  - What do I think this is, and what do I do next?
  - What do I expect to happen when I tap it, and does it?
  - Which line here would I not miss? Which word don't I know?
  - Is anything repeated, slow or untrue?
  - Could fewer steps, choices or words do the same job?
  - Would I come back tomorrow?

## 4. Fix, push back, and lock it in

- Fix friction within scope. Fix confusion by the fix order in zoonk-design's [Words](../zoonk-design/SKILL.md#words): remove, rename, show, move; a new sentence is the last resort, and it takes another one out. When the better experience conflicts with the request or a repository rule, explain the conflict concretely and propose the alternative instead of building the worse version silently.
- Give a reproducible problem a regression test when [zoonk-testing](../zoonk-testing/SKILL.md)'s bar says one is worth it, at the cheapest layer that reproduces it: a core test for a rule or a plan's behavior, an eval case for AI output, a player browser test for lesson interactions, and an E2E journey (seeded persona copies through `asPersona`) only for a high-risk flow nothing cheaper catches. Wording, layout and other low-risk fixes are checked by walking the journey again, not by a permanent test.
- Walk the affected journey again after the fix.

## 5. Report the evidence

For each persona, report:

- their starting state and the journeys walked
- the screens seen, with screenshot paths
- each screen's first-glance answers, and what they changed
- what was confusing, unneeded, broken or slow, and what you changed or removed
- the tests you added
- what remains unverified

Passing tests are not a walkthrough. Simulated personas uncover friction, but they don't prove usability for real people, so say so where it matters.

For loads and navigation, use a production build on a phone with CPU and network throttling. Walk hard loads, prefetched taps, an early tap before prefetch settles, an unprefetched link and a tap right after a cold load, before the page's code is ready (`verify:pages --nav --no-prefetch` and `--early` measure the last two). Skeletons are valid; judge whether meaningful shell UI responds immediately, the content arrives promptly, and anything blanks, freezes, flashes or shifts. Save before/after filmstrips and report response and content times separately, with your own read of how each feels. Keep private cached prefetches and never hide loading by holding paint.
