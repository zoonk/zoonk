import { afterEach, describe, expect, it, vi } from "vitest";
import { type BuildPlanInput, buildPlan } from "../planner/build-plan";
import { fromIsoDate } from "../planner/plan-calendar";
import { getPlanFeasibility } from "../planner/plan-feasibility";
import { parsePlanSettings } from "../planner/plan-state";
import { getBehindChoices } from "./falling-behind";

function input(): BuildPlanInput {
  return {
    goal: { dailyMinutes: 10, kind: "exam", targetDate: fromIsoDate("2026-10-12") },
    graph: {
      phases: [{ milestone: null, name: "Exam topics" }],
      skills: [
        { area: "Math", lessons: 12, name: "Math", phase: 0, skillId: "math", weight: 1 },
        { area: "Law", lessons: 12, name: "Law", phase: 0, skillId: "law", weight: 1 },
      ],
    },
    items: [],
    lessons: [],
    mockMinutes: 150,
    mode: "forced",
    paceFactor: 1,
    prerequisites: new Map(),
    readiness: new Map(),
    settings: parsePlanSettings({ startDate: "2026-09-28" }),
    today: fromIsoDate("2026-09-28"),
  };
}

describe(getBehindChoices, () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps exact notice advice without computing unused topic-time and full-course alternatives", () => {
    const source = input();
    const feasibility = getPlanFeasibility({ input: source, planned: buildPlan(source) });
    // Observe the real lazy getters; their calculations and returned values are unchanged.
    const core = vi.spyOn(feasibility, "coreMinutes", "get");
    const fullCourse = vi.spyOn(feasibility, "fullCourseEndDate", "get");
    const alternative = vi.spyOn(feasibility, "alternative", "get");
    const endDate = vi.spyOn(feasibility, "endDate", "get");
    const covers = vi.spyOn(feasibility, "timeCovers", "get");

    const choices = getBehindChoices({
      feasibility,
      state: {
        goal: { dailyMinutes: source.goal.dailyMinutes, targetDate: "2026-10-12" },
        graph: source.graph,
        settings: source.settings,
      },
    });

    expect(choices).toStrictEqual({
      canFocus: true,
      currentMinutes: 10,
      dailyMinutes: feasibility.recommendedMinutes,
      fittingDate: null,
      fullDepth: true,
      maximumShare: null,
      measure: "goal",
    });

    for (const getter of [core, fullCourse, alternative, endDate, covers]) {
      expect(getter).not.toHaveBeenCalled();
    }
  });
});
