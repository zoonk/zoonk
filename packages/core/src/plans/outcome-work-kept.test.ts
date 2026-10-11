import { describe, expect, it } from "vitest";
import { runSimLife } from "./_test-utils/sim/sim-life";

const MINUTE = 60_000;

// The buddy cut a 90-day career plan to 15 minutes a day; the change kept the job search, and the
// next morning's settle left networking and interviews out to keep the phase ends the learner saw.
describe("a career plan short on time", () => {
  it(
    "keeps its outcome work through the next day's settle",
    async () => {
      const { violations } = await runSimLife({
        dailyMinutes: 60,
        fixture: "career",
        knownAreas: [],
        pending: [],
        seed: 1002,
        speed: 1,
        start: "2026-10-12",
        steps: [
          { kind: "change", spec: { area: 3, kind: "reduce" }, via: "buddy" },
          { finish: 0.5, kind: "study", misses: [] },
          { days: 2, kind: "miss" },
          { kind: "change", spec: { kind: "time", minutes: 15 }, via: "buddy" },
          { finish: 0.75, kind: "study", misses: [] },
          { finish: 0.25, kind: "study", misses: [] },
        ],
        subscribed: false,
        targetInDays: 90,
      });

      expect(violations.filter((violation) => violation.rule === "R13")).toStrictEqual([]);
    },
    MINUTE,
  );
});
