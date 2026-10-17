import { describe, expect, it } from "vitest";
import { parsePlanSnapshot } from "./plan-snapshot";

/** A snapshot an undo saved before summaries described their plan version. */
const legacy = {
  coveredShare: 0.5,
  estimateHours: 2,
  inputsKey: "legacy-key",
  items: [],
  phases: [],
  sourceSkillIds: [],
  state: { goal: { dailyMinutes: 20, targetDate: null }, graph: {}, settings: {} },
  summary: {
    basis: {
      inputVersion: 1,
      planId: "plan-a",
      planVersion: 2,
      studyDay: "2026-10-12",
      timeZone: "UTC",
      userId: "learner-a",
    },
    schemaVersion: 1,
    selected: {},
  },
};

describe(parsePlanSnapshot, () => {
  it("still restores a snapshot saved before, its summary pending", () => {
    expect(parsePlanSnapshot(legacy)).toMatchObject({ inputsKey: "legacy-key", summary: null });
  });

  it("restores a snapshot saved before plans had a summary", () => {
    const { summary: _summary, ...older } = legacy;
    expect(parsePlanSnapshot(older)).toMatchObject({ summary: null });
  });
});
