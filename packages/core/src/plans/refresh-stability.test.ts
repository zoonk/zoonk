import { describe, expect, it } from "vitest";
import { checkRefreshChangesNothing } from "./_test-utils/rules/stability-rules";
import { runSimLife } from "./_test-utils/sim/sim-life";
import { type SimLife } from "./_test-utils/sim/sim-life-plan";

const MINUTE = 60_000;

/** The life's R32 violations: only that rule runs after each step. */
async function findViolations(life: SimLife) {
  const { violations } = await runSimLife(life, { check: checkRefreshChangesNothing });
  return violations;
}

/*
 * The other lives of this file are focused tests now, mostly in `planner/build-plan-runs.test.ts`.
 * These two still fail on no single fix: neither does when the fix their comment names is
 * reverted, so they stay as generic checks that a refresh with nothing new changes nothing (R32).
 */

// An automatic run that would date new work this week lays the rest out from the week after,
// after the time this week's work takes past it. Read from the run's own layout, which put this
// week's work in another order, that time was a stand-in and a lesson more than the saved plan
// had, and an IELTS refresh moved the next three stand-ins a day.
describe("a refresh when this week's last stand-in runs past it", () => {
  it(
    "keeps an IELTS plan as it is",
    async () => {
      const violations = await findViolations({
        dailyMinutes: 20,
        fixture: "ielts",
        knownAreas: [1],
        pending: [],
        seed: 1001,
        speed: 1,
        start: "2026-10-12",
        steps: [
          { finish: 0.75, kind: "study", misses: [3] },
          { kind: "change", spec: { area: 1, kind: "focus" }, via: "editor" },
          { count: 2, kind: "land" },
          { finish: 1, kind: "study", misses: [] },
          { kind: "refresh" },
        ],
        subscribed: false,
        targetInDays: 75,
      });

      expect(violations).toStrictEqual([]);
    },
    MINUTE,
  );
});

// An automatic run keeps this week's lessons on their days, and the plan's practice days start
// after the last of them. Read from the run's own copies of that work, a career's last lessons,
// kept on Sunday, ended on Monday, and the refresh took Monday's practice day out of the plan.
describe("a refresh when the plan's last lessons are this week", () => {
  it(
    "keeps a career plan's first practice day",
    async () => {
      const violations = await findViolations({
        dailyMinutes: 30,
        fixture: "career",
        knownAreas: [],
        pending: [2, 8, 13, 14, 18, 25, 26],
        seed: 1027,
        speed: 1,
        start: "2026-10-12",
        steps: [
          { kind: "change", spec: { kind: "time", minutes: 180 }, via: "editor" },
          { days: 2, kind: "miss" },
          { finish: 1, kind: "study", misses: [25] },
          { finish: 0.25, kind: "study", misses: [] },
          { finish: 0.75, kind: "study", misses: [] },
          { finish: 0.75, kind: "study", misses: [] },
          { finish: 1, kind: "study", misses: [] },
          { finish: 1, kind: "study", misses: [] },
          { days: 3, kind: "miss" },
          { finish: 1, kind: "study", misses: [17] },
          { finish: 1, kind: "study", misses: [] },
          { finish: 1, kind: "study", misses: [] },
          { finish: 1, kind: "study", misses: [] },
          { finish: 0.25, kind: "study", misses: [12] },
          { kind: "refresh" },
        ],
        subscribed: false,
        targetInDays: 114,
      });

      expect(violations).toStrictEqual([]);
    },
    MINUTE,
  );
});
