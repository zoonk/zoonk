import { describe, expect, it } from "vitest";
import { parsePlanSnapshot } from "./plan-snapshot";

/** A snapshot an undo saved before summaries described their plan version and plans had keys. */
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
  it("still restores a snapshot saved before, its summary pending and without keys", () => {
    expect(parsePlanSnapshot(legacy)).toMatchObject({
      inputsKey: "legacy-key",
      layoutKeys: null,
      summary: null,
    });
  });

  it("keeps the keys of what the plan was planned from", () => {
    const layoutKeys = { placement: "placement-key", scope: "scope-key", version: 1 };
    expect(parsePlanSnapshot({ ...legacy, layoutKeys })?.layoutKeys).toStrictEqual(layoutKeys);
  });

  it("restores a snapshot saved before plans had a summary", () => {
    const { summary: _summary, ...older } = legacy;
    expect(parsePlanSnapshot(older)).toMatchObject({ layoutKeys: null, summary: null });
  });
});
