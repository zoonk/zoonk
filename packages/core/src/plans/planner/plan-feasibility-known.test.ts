import { describe, expect, it } from "vitest";
import { toFeasibilityView } from "../_utils/plan-feasibility-view";
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
  it.each([0, 1])("credits a known topic when the missing topic has weight %i", (weight) => {
    const input = {
      goal: { dailyMinutes: 15, kind: "learn" as const, targetDate: fromIsoDate("2026-09-29") },
      graph: {
        phases: [{ milestone: null, name: "Everything" }],
        skills: [
          { area: null, lessons: 6, name: "Known", phase: 0, skillId: "known", weight: 999 },
          { area: null, lessons: 6, name: "New", phase: 0, skillId: "new", weight },
        ],
      },
      items: [],
      knownSkillIds: new Set(["known"]),
      lessons: [],
      mockMinutes: 150,
      mode: "forced" as const,
      paceFactor: 1,
      prerequisites: new Map(),
      readiness: new Map(),
      settings: parsePlanSettings({ startDate: "2026-09-29" }),
      today: fromIsoDate("2026-09-29"),
    };

    const feasibility = getPlanFeasibility({ input });
    expect(feasibility.coreFits).toBe(false);
    expect(feasibility.reachedShare).toBeCloseTo(999 / (999 + weight));
    expect(feasibility.reachedShare).toBeLessThan(1);
    expect(feasibility.reachedShare).toBeGreaterThanOrEqual(feasibility.coveredShare);

    expect(toFeasibilityView(feasibility)).toMatchObject({
      coveredShare: 0.99,
      reachedShare: 0.99,
    });
  });

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
