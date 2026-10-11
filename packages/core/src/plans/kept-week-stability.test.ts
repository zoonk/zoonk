import { describe, expect, it } from "vitest";
import { runSimLife } from "./_test-utils/sim/sim-life";

const MINUTE = 60_000;

// A run with nothing new reproduces the saved plan: the first open of Today after a career plan was
// made moved 240 of its 247 lessons days later, a stand-in that began the week the plan was made
// taking days more once laid out from the next week.
describe("an automatic run after a plan was made", () => {
  it(
    "keeps a new plan as it is on the first open of Today",
    async () => {
      const { violations } = await runSimLife({
        dailyMinutes: 15,
        fixture: "career",
        knownAreas: [],
        pending: [1, 12, 13],
        seed: 4,
        speed: 0.8,
        start: "2026-10-12",
        steps: [{ finish: 1, kind: "study", misses: [] }],
        subscribed: false,
        targetInDays: 211,
      });

      expect(violations.filter((violation) => violation.rule === "R32")).toStrictEqual([]);
    },
    MINUTE,
  );
});
