import { describe, expect, it } from "vitest";
import { fromIsoDate } from "./plan-calendar";
import { getPlanFeasibility } from "./plan-feasibility";
import { parsePlanSettings } from "./plan-state";
import { type SkillReadiness } from "./skill-order";

/** A skill the learner answered right in practice: memory, but not shown known (R17). */
const PRACTICED: SkillReadiness = {
  reps: 1,
  retrievabilityAtTarget: 0.8,
  stability: 3,
  state: "learning",
};

describe(getPlanFeasibility, () => {
  // R25 (class test seed 1002): read as known, a skill answered right only in practice counted as
  // in while the syllabus showed its topics out for time, and the plan said every topic fits.
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
