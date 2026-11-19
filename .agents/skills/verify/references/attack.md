# Attack every new entry point

Part of step 3 of [verify](../SKILL.md). Sequential happy paths never show what a double tap, a second tab, a retry or someone acting in bad faith does, and the repository treats those as ordinary traffic ([admission](../../../../packages/core/AGENTS.md#admission)).

For each new or changed entry point (action, route, API endpoint), send:

- the same request twice, and several at once (background `curl`s with a persona's bearer token, or `Promise.all` of fetches)
- a field the client shouldn't control: another learner's id, an edited `details`, a reported length or count
- an oversized body or file
- the request again after the work failed halfway, or after what it made was merged, shared or updated

Then count what was charged, recorded, started and published: each happens once, and a refusal comes before anything is spent.

Turn each hole into a regression test at the cheapest layer that reproduces it ([zoonk-testing](../../zoonk-testing/SKILL.md)). For a race in core, `holdLearnerLock` and `waitForBlockedStatement` (`packages/core/src/_test-utils/learner-lock.ts`) hold the requests at the learner's lock until all of them wait there.
