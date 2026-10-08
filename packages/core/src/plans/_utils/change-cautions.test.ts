import { describe, expect, it } from "vitest";
import { findChangeCautions } from "./change-cautions";

const GOAL = {
  createdAt: new Date("2026-10-01T00:00:00Z"),
  details: {},
  examBlueprintId: null,
  kind: "language" as const,
  targetDate: new Date("2027-01-06T00:00:00Z"),
  timezone: "UTC",
};

function effect({ after, before }: { after: string; before: string }) {
  return { endDateAfter: after, endDateBefore: before, lessonsAdded: 0, lessonsRemoved: 55 };
}

describe(findChangeCautions, () => {
  it("says a plan would end weeks before its date, with those weeks left without lessons", async () => {
    await expect(
      findChangeCautions({
        effect: effect({ after: "2026-11-27", before: "2026-12-17" }),
        goal: GOAL,
        operations: [{ bias: "harder", kind: "setDifficultyBias" }],
      }),
    ).resolves.toStrictEqual([
      { endDate: "2026-11-27", kind: "endsBeforeDate", targetDate: "2027-01-06" },
    ]);
  });

  it("says nothing when the plan still ends close to its date or doesn't end earlier", async () => {
    await expect(
      findChangeCautions({
        effect: effect({ after: "2027-01-02", before: "2027-01-05" }),
        goal: GOAL,
        operations: [{ bias: "harder", kind: "setDifficultyBias" }],
      }),
    ).resolves.toStrictEqual([]);

    // Already ending early, a change that doesn't end it earlier costs nothing new.
    await expect(
      findChangeCautions({
        effect: effect({ after: "2026-12-01", before: "2026-11-20" }),
        goal: GOAL,
        operations: [{ kind: "setDailyMinutes", minutes: 20 }],
      }),
    ).resolves.toStrictEqual([]);
  });

  it("measures an early end against the date the change itself sets", async () => {
    await expect(
      findChangeCautions({
        effect: effect({ after: "2026-11-27", before: "2026-12-17" }),
        goal: GOAL,
        operations: [{ kind: "setTargetDate", targetDate: "2026-12-01" }],
      }),
    ).resolves.toStrictEqual([]);
  });
});
