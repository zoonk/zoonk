import { describe, expect, it } from "vitest";
import { checkMostAskedKept } from "./_test-utils/rules/most-asked-rules";
import { runSimLife } from "./_test-utils/sim/sim-life";

const MINUTE = 60_000;

describe("a plan short on time cuts the least asked topics first", () => {
  // Four missed days two weeks before the class test, with the prokaryotes base as a quick lesson:
  // the catch-up kept cell theory, which nobody asked about, and left out the nucleus, which
  // placement had just found missing. The plan with the base's whole core set cell theory aside,
  // but the plan following its order carried it in first all the same (see
  // `scheduleCarriedAndRest`). A life, since the settle needs both plans built from the class
  // test's library and placement's answers to show it.
  it(
    "sets aside the same earlier days' work when a base is studied another way",
    async () => {
      const { violations } = await runSimLife(
        {
          dailyMinutes: 20,
          fixture: "class-test",
          knownAreas: [],
          pending: [],
          seed: 1125,
          speed: 1,
          start: "2026-10-12",
          steps: [
            {
              answers: [
                [1, true],
                [3, false],
                [5, false],
                [4, false],
                [3, true],
                [6, false],
                [1, false],
                [3, false],
              ],
              kind: "placement",
            },
            { days: 4, kind: "miss" },
            { kind: "refresh" },
          ],
          subscribed: false,
          targetInDays: 14,
        },
        { check: checkMostAskedKept },
      );

      expect(violations).toStrictEqual([]);
    },
    MINUTE,
  );
});
