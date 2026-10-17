import { describe, expect, it } from "vitest";
import { checkMostAskedKept } from "./_test-utils/rules/most-asked-rules";
import { runSimLife } from "./_test-utils/sim/sim-life";

const MINUTE = 60_000;

// Four days to the class test at 20 minutes a day: organelles, the topic the notes say comes up a
// lot and the teacher's organelle table, had no lesson while the membrane and osmosis kept theirs.
describe("a class test short on time", () => {
  it(
    "keeps the most asked topic's core before less asked topics' lessons",
    async () => {
      const { violations } = await runSimLife(
        {
          dailyMinutes: 20,
          fixture: "class-test",
          knownAreas: [],
          pending: [],
          seed: 1002,
          speed: 1,
          start: "2026-10-12",
          steps: [],
          subscribed: false,
          targetInDays: 4,
        },
        { check: checkMostAskedKept },
      );

      expect(violations.filter((violation) => violation.rule === "R11")).toStrictEqual([]);
    },
    MINUTE,
  );
});
