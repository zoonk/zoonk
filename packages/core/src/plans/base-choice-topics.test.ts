import { describe, expect, it } from "vitest";
import { checkBaseChoicesKeepTopics } from "./_test-utils/rules/keep-rules";
import { runSimLife } from "./_test-utils/sim/sim-life";

const MINUTE = 60_000;

describe("a base choice never pushes out a topic", () => {
  // A class test 6 days away at 30 minutes a day: after the learner chose the core of prokaryotes
  // and eukaryotes over its quick lesson, two missed days set cell theory's only lesson aside. Then
  // they chose to study that base in depth: the change brought cell theory back in the nucleus's
  // place, and the card said the nucleus was left out. Guards both `pickSetAsidePlans` (set-aside
  // work comes back only when it costs no topic the plan holds) and `getKeptBaseChoices` (a choice
  // for a base whose core the learner studied changes nothing; see `chosen-bases.test.ts`).
  it(
    "keeps a topic the plan holds when work set aside for time would take its place",
    async () => {
      const { violations } = await runSimLife(
        {
          dailyMinutes: 30,
          fixture: "class-test",
          knownAreas: [],
          pending: [0, 2, 3],
          seed: 75,
          speed: 1,
          start: "2026-10-12",
          steps: [
            { finish: 0.25, kind: "study", misses: [] },
            { kind: "change", spec: { base: 0, choice: "essential", kind: "bases" } },
            { days: 2, kind: "miss" },
            { finish: 0.5, kind: "study", misses: [5] },
            { kind: "change", spec: { base: 0, choice: "deep", kind: "bases" } },
          ],
          subscribed: false,
          targetInDays: 6,
        },
        { check: checkBaseChoicesKeepTopics },
      );

      expect(violations).toStrictEqual([]);
    },
    MINUTE,
  );
});
