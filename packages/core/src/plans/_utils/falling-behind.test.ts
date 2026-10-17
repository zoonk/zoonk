import { afterEach, describe, expect, it, vi } from "vitest";
import { type BuildPlanInput, buildPlan } from "../planner/build-plan";
import { fromIsoDate } from "../planner/plan-calendar";
import { getPlanFeasibility } from "../planner/plan-feasibility";
import { parsePlanSettings } from "../planner/plan-state";
import { getFallingBehind } from "./falling-behind";

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

describe(getFallingBehind, () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("says what the missed days did at the learner's time, without planning other daily times or dates", () => {
    const source = input();
    const feasibility = getPlanFeasibility({ input: source, planned: buildPlan(source) });
    // Observe the real lazy getters: each one plans the goal again at other daily times or dates.
    const searches = (
      [
        "alternative",
        "coreMinutes",
        "fittingDate",
        "fullCourseEndDate",
        "maximum",
        "recommendedMinutes",
        "timeCovers",
      ] as const
    ).map((field) => vi.spyOn(feasibility, field, "get"));

    const behind = getFallingBehind({
      computed: {
        feasibility,
        state: {
          goal: { dailyMinutes: source.goal.dailyMinutes, targetDate: "2026-10-12" },
          graph: source.graph,
          settings: source.settings,
        },
      },
      context: { plan: { coveredShare: 1 } },
    });

    expect(feasibility.coveredShare).toBeLessThan(1);

    expect(behind).toStrictEqual({
      canFocus: true,
      coveredAfter: Math.round(feasibility.coveredShare * 100) / 100,
      coveredBefore: 1,
      currentMinutes: 10,
      measure: "goal",
    });

    for (const getter of searches) {
      expect(getter).not.toHaveBeenCalled();
    }
  });
});
