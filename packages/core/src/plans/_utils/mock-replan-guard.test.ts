import { describe, expect, it } from "vitest";
import { parsePlanPhases } from "../planner/plan-state";
import { holdsSchedule } from "./mock-replan-guard";

function plan({
  coveredShare = 0.9,
  droppedSkillIds = ["statistics"],
  endDate = "2026-12-01",
}: { coveredShare?: number; droppedSkillIds?: string[]; endDate?: string } = {}) {
  return {
    built: {
      droppedSkillIds,
      phases: parsePlanPhases([
        { endDate, name: "Base" },
        { endDate: "2027-01-15", name: "Review" },
      ]),
    },
    feasibility: { coveredShare },
  };
}

describe(holdsSchedule, () => {
  it("lets a reorder through that covers as much, keeps the same topics and the phase dates", () => {
    expect(holdsSchedule({ baseline: plan(), computed: plan() })).toBe(true);
    expect(holdsSchedule({ baseline: plan(), computed: plan({ droppedSkillIds: [] }) })).toBe(true);
  });

  it("refuses one that covers less by the date", () => {
    expect(holdsSchedule({ baseline: plan(), computed: plan({ coveredShare: 0.85 }) })).toBe(false);
  });

  it("refuses one that leaves out a topic the plan keeps without it", () => {
    const computed = plan({ droppedSkillIds: ["statistics", "geometry"] });
    expect(holdsSchedule({ baseline: plan(), computed })).toBe(false);
  });

  it("refuses one that moves a phase's end", () => {
    const computed = plan({ endDate: "2026-12-08" });
    expect(holdsSchedule({ baseline: plan(), computed })).toBe(false);
  });
});
