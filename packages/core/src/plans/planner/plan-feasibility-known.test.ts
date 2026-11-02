import { describe, expect, it } from "vitest";
import { fromIsoDate } from "./plan-calendar";
import { getPlanFeasibility } from "./plan-feasibility";
import { parsePlanSettings } from "./plan-state";
import { type SkillReadiness } from "./skill-order";

const PRACTICED: SkillReadiness = {
  reps: 1,
  retrievabilityAtTarget: 0.8,
  stability: 3,
  state: "learning",
};

describe(getPlanFeasibility, () => {
  it("counts a skill out for time as out though the learner practiced it", () => {
    const skills = Array.from({ length: 8 }, (_, index) => ({
      area: null,
      lessons: 60,
      name: `Skill ${index}`,
      phase: 0,
      skillId: `s${index}`,
      weight: 8 - index,
    }));

    const feasibility = getPlanFeasibility({
      input: {
        goal: { dailyMinutes: 10, kind: "learn", targetDate: fromIsoDate("2026-10-05") },
        graph: { phases: [{ milestone: null, name: "Everything" }], skills },
        items: [],
        knownSkillIds: new Set(),
        lessons: [],
        mockMinutes: 150,
        mode: "forced",
        paceFactor: 1,
        prerequisites: new Map(),
        readiness: new Map(skills.map((skill) => [skill.skillId, PRACTICED])),
        settings: parsePlanSettings({ startDate: "2026-09-28" }),
        today: fromIsoDate("2026-09-28"),
      },
    });

    expect(feasibility.coreFits).toBe(false);
  });
});
