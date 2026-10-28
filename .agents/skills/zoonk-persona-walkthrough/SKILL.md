---
name: zoonk-persona-walkthrough
description: Use the running product as realistic learner personas, including their bad days, before calling a user-facing change done. Pick personas from the change's risks, put them in a realistic state cheaply, walk with fresh eyes, fix or push back, turn every reproducible problem into a regression test, and report the evidence.
license: MIT
metadata:
  author: zoonk
  version: "1.0.0"
---

# Persona walkthrough

Automated tests prove what they exercise, and the person who built a feature fills gaps with knowledge a learner doesn't have. This walkthrough checks what a real learner gets: whether the experience is clear, simple, honest and recoverable, on the first day and on the days after it.

Use it for any change a learner can see or feel: screens, flows, copy, plan behavior, AI output they read, waits, limits and errors. For a change no learner can notice, say why you skipped it.

## 1. Pick personas from the change's risks

- Start from the [persona catalog](references/personas.md). Pick two to four personas who differ on what the change touches: goal type, plan tier, daily time, device, language, history.
- At least one must be off the happy path for this change: behind on the plan, free at a limit, back after a week away, changing their mind, on a small phone, using a screen reader.
- When an issue or feature has no persona that fits it well, add one to the catalog with the same fields, so later walks reuse it.

## 2. Put each persona in a realistic state, cheaply

- Prefer seeded personas and the persona command described in the catalog. They give a realistic learner at a chosen point of their plan with no AI cost.
- Use the real onboarding when the journey starts there. Keep the shared Library warm between passes (development guide, "Persona passes") so walks don't pay to generate content again.
- Seeded data can't show whether real AI output works. When the change depends on what a model writes, reads or grades, walk it at least once end to end with real AI output, and keep those runs few and small. Turn what you checked by eye into eval cases, so later changes are checked without paying for another walk.
- Use the persona's device size, time zone and language, in light and dark.

## 3. Walk with fresh eyes

- Walk the production build `pnpm start` serves, not a dev server: it's what learners get, and a dev server adds compile waits and loading states they never see ([development guide](../../guides/development.md)).
- A builder can't unknow the implementation. For substantial changes, have a separate agent walk with only the persona brief, the journeys to cover and the app URL, without the diff, and report back; the builder fixes. When you walk your own work, write down what the persona knows before each screen and judge only from what the screen shows.
- Enter through the normal UI, reach the outcome, then come back: the next day, after a gap, on another device.
- Cover the unhappy paths in [journeys](references/journeys.md) for every surface the change reaches, not only the screen you edited.
- At each screen, ask as the persona:
  - What do I think this is, and what do I do next?
  - What do I expect to happen when I tap it, and does it?
  - Is anything here unnecessary, repeated, confusing, slow or dishonest?
  - Could fewer steps, choices or words do the same job?
  - Would I come back tomorrow?

## 4. Fix, push back, and lock it in

- Fix friction within scope. When the better experience conflicts with the request or a repository rule, explain the conflict concretely and propose the alternative instead of building the worse version silently.
- Give a reproducible problem a regression test when [zoonk-testing](../zoonk-testing/SKILL.md)'s bar says one is worth it, at the cheapest layer that reproduces it: a core test for a rule or a plan's behavior, an eval case for AI output, a player browser test for lesson interactions, and an E2E journey (seeded persona copies through `asPersona`) only for a high-risk flow nothing cheaper catches. Wording, layout and other low-risk fixes are checked by walking the journey again, not by a permanent test.
- Walk the affected journey again after the fix.

## 5. Report the evidence

For each persona, report:

- their starting state and the journeys walked
- the screens seen, with screenshot paths
- what was confusing, broken or slow, and what you changed
- the tests you added
- what remains unverified

Passing tests are not a walkthrough. Simulated personas uncover friction, but they don't prove usability for real people, so say so where it matters.
