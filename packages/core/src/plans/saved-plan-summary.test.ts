import { describe, expect, it } from "vitest";
import {
  type PlanSummaryBasis,
  type SavedPlanSummary,
  readFreshPlanSummary,
} from "./_utils/plan-summary";

const basis: PlanSummaryBasis = {
  inputVersion: 4,
  planId: "plan-a",
  planVersion: 7,
  studyDay: "2026-10-14",
  timeZone: "America/Sao_Paulo",
  userId: "learner-a",
};

const summary: SavedPlanSummary = {
  basis,
  schemaVersion: 1,
  selected: {
    bases: null,
    coverage: null,
    dailyNeed: { basis: "estimated", minutes: null, reason: "noDeadline" },
    endDate: "2026-10-21",
    requirement: { doneRaw: 30, remainingRaw: 120, totalRaw: 150 },
    sourceSkillIds: ["skill-a"],
    totalMinutes: 180,
  },
};

describe("saved plan freshness", () => {
  it("reuses actual selected facts only for the same owned plan and complete input basis", () => {
    expect(readFreshPlanSummary({ basis, value: summary })).toStrictEqual(summary);
  });

  it.each<Partial<PlanSummaryBasis>>([
    { inputVersion: 5 },
    { planId: "plan-b" },
    { planVersion: 8 },
    { studyDay: "2026-10-15" },
    { timeZone: "UTC" },
    { userId: "learner-b" },
  ])("requires a build when a basis input changes (%j)", (change) => {
    expect(readFreshPlanSummary({ basis: { ...basis, ...change }, value: summary })).toBeNull();
  });

  it("keeps another learner isolated even when every other input is identical", () => {
    const other = { ...basis, userId: "learner-b" };
    const ownSummary = { ...summary, basis: other };

    expect(readFreshPlanSummary({ basis: other, value: ownSummary })).toStrictEqual(ownSummary);
    expect(readFreshPlanSummary({ basis: other, value: summary })).toBeNull();
  });

  it.each([null, {}, { ...summary, schemaVersion: 0 }])(
    "initializes a missing or legacy summary instead of returning an empty plan (%j)",
    (value) => {
      expect(readFreshPlanSummary({ basis, value })).toBeNull();
    },
  );
});
