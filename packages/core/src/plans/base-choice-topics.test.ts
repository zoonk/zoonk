import { describe, expect, it } from "vitest";
import { runSimLife } from "./_test-utils/sim/sim-life";
import { type SimLife } from "./_test-utils/sim/sim-life-plan";

const MINUTE = 60_000;

async function findR15(life: SimLife) {
  const { violations } = await runSimLife(life);
  return violations.filter((violation) => violation.rule === "R15");
}

describe("a base choice never pushes out a topic", () => {
  // A class test 11 days away at 15 minutes a day: after missed days set an osmosis lesson aside,
  // the learner chose a quick lesson for prokaryotes and eukaryotes, whose core they had studied.
  // The change brought the osmosis lesson back, which outranked cell theory's only lesson, and the
  // card said cell theory was left out.
  it(
    "leaves the plan as it is for a base whose core the learner studied",
    async () => {
      const violations = await findR15({
        dailyMinutes: 15,
        fixture: "class-test",
        knownAreas: [],
        pending: [],
        seed: 1255,
        speed: 1,
        start: "2026-10-12",
        steps: [
          { finish: 1, kind: "study", misses: [] },
          { finish: 1, kind: "study", misses: [] },
          { finish: 0.75, kind: "study", misses: [] },
          { finish: 0.75, kind: "study", misses: [] },
          { days: 2, kind: "miss" },
          { finish: 0.75, kind: "study", misses: [] },
          { kind: "change", spec: { base: 0, choice: "quick", kind: "bases" }, via: "editor" },
        ],
        subscribed: true,
        targetInDays: 11,
      });

      expect(violations).toStrictEqual([]);
    },
    MINUTE,
  );

  // A class test 6 days away at 30 minutes a day: after the learner chose the core of prokaryotes
  // and eukaryotes over its quick lesson, two missed days set cell theory's only lesson aside. Then
  // they chose to study that base in depth: the change brought cell theory back in the nucleus's
  // place, and the card said the nucleus was left out.
  it(
    "keeps a topic the plan holds when work set aside for time would take its place",
    async () => {
      const violations = await findR15({
        dailyMinutes: 30,
        fixture: "class-test",
        knownAreas: [],
        pending: [0, 2, 3],
        seed: 75,
        speed: 1,
        start: "2026-10-12",
        steps: [
          { finish: 0.25, kind: "study", misses: [] },
          { kind: "change", spec: { base: 0, choice: "essential", kind: "bases" }, via: "editor" },
          { days: 2, kind: "miss" },
          { finish: 0.5, kind: "study", misses: [5] },
          { kind: "change", spec: { base: 0, choice: "deep", kind: "bases" }, via: "editor" },
        ],
        subscribed: false,
        targetInDays: 6,
      });

      expect(violations).toStrictEqual([]);
    },
    MINUTE,
  );
});
