import { describe, expect, it } from "vitest";
import { getSetupProgress } from "./setup-progress";

describe(getSetupProgress, () => {
  it("keeps the total when a beginner skips placement", () => {
    const before = getSetupProgress({
      current: "level",
      history: ["targetDate"],
      view: { steps: ["level", "buddy", "placement", "schedule", "plan"] },
    });

    const after = getSetupProgress({
      current: "buddy",
      history: ["targetDate", "level"],
      view: { steps: ["buddy", "schedule", "plan"] },
    });

    expect(before).toStrictEqual({ current: 1, total: 4 });
    expect(after).toStrictEqual({ current: 2, total: 4 });
  });

  it("counts setup questions after placement without counting the test", () => {
    expect(
      getSetupProgress({
        current: "schedule",
        history: ["targetDate", "level", "buddy", "placement"],
        view: { steps: ["schedule", "plan"] },
      }),
    ).toStrictEqual({ current: 3, total: 4 });
  });

  it("leaves placement and the plan to their own progress", () => {
    for (const current of ["placement", "plan"] as const) {
      expect(
        getSetupProgress({
          current,
          history: ["level"],
          view: { steps: [current, "schedule", "plan"] },
        }),
      ).toBeNull();
    }
  });
});
