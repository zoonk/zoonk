import { describe, expect, it } from "vitest";
import { runSimLife } from "./_test-utils/sim/sim-life";

const MINUTE = 60_000;

describe("a class test's last days", () => {
  // Lessons written on day one for three stand-ins went on the day before the test, its review.
  it(
    "keeps lessons written since off the day before the test",
    async () => {
      const { violations } = await runSimLife({
        dailyMinutes: 30,
        fixture: "class-test",
        knownAreas: [],
        pending: [2, 3, 4],
        seed: 1012,
        speed: 1,
        start: "2026-10-12",
        steps: [{ finish: 1, kind: "study", misses: [] }],
        subscribed: false,
        targetInDays: 4,
      });

      expect(violations.filter((violation) => violation.rule === "R23")).toStrictEqual([]);
    },
    MINUTE,
  );

  // Missed days took the plan's mock with them, and nothing came in its place before the test.
  it(
    "plans a missed mock again before the test",
    async () => {
      const { violations } = await runSimLife({
        dailyMinutes: 20,
        fixture: "class-test",
        knownAreas: [],
        pending: [],
        seed: 1016,
        speed: 1,
        start: "2026-10-12",
        steps: [
          { finish: 1, kind: "study", misses: [] },
          { finish: 0.75, kind: "study", misses: [6] },
          { finish: 0.5, kind: "study", misses: [] },
          { finish: 0.75, kind: "study", misses: [] },
          { kind: "refresh" },
          { days: 3, kind: "miss" },
          { finish: 0.5, kind: "study", misses: [1] },
        ],
        subscribed: false,
        targetInDays: 12,
      });

      expect(violations.filter((violation) => violation.rule === "R24")).toStrictEqual([]);
    },
    MINUTE,
  );
});
