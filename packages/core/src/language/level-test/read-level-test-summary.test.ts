import { describe, expect, it } from "vitest";
import { readLevelTestSummary } from "./read-level-test-summary";

function goalAt(level: string, levelsSkipped: string[] = []) {
  return {
    details: {
      level,
      levelTest:
        levelsSkipped.length > 0
          ? {
              lastResult: {
                attemptId: null,
                finishedAt: "2026-11-21T12:00:00.000Z",
                levelsSkipped,
                ranges: {},
              },
            }
          : {},
    },
  };
}

describe(readLevelTestSummary, () => {
  it("offers no test-out to a learner more than one level below B2", () => {
    expect(readLevelTestSummary(goalAt("A1")).nextTestOutLevel).toBeNull();
    expect(readLevelTestSummary(goalAt("A2")).nextTestOutLevel).toBeNull();
  });

  it("offers the level right above a B1 learner", () => {
    expect(readLevelTestSummary(goalAt("B1")).nextTestOutLevel).toBe("B2");
  });

  it("offers the learner's own level from B2 up", () => {
    expect(readLevelTestSummary(goalAt("B2")).nextTestOutLevel).toBe("B2");
    expect(readLevelTestSummary(goalAt("C1")).nextTestOutLevel).toBe("C1");
  });

  it("checks eligibility from the weaker tap-tested skill after a test", () => {
    const { details } = goalAt("C1");
    const skillLevels = { listening: "C2", reading: "A2+" };

    expect(
      readLevelTestSummary({ details: { ...details, skillLevels } }).nextTestOutLevel,
    ).toBeNull();
  });

  it("moves on to the next level once one is skipped", () => {
    expect(readLevelTestSummary(goalAt("B2", ["B2"])).nextTestOutLevel).toBe("C1");
  });
});
