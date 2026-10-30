import { describe, expect, it } from "vitest";
import { type BuildPlanInput, buildPlan } from "./build-plan";
import { findFittingMinutes, withDailyMinutes } from "./daily-time-plans";
import { fromIsoDate } from "./plan-calendar";
import { getPlanFeasibility } from "./plan-feasibility";
import { parsePlanSettings } from "./plan-state";
import { getSelectedCoverage } from "./selected-plan-summary";

function repeatedTitleInput(): BuildPlanInput {
  const repeated = Array.from({ length: 10 }, (_, index) => `repeated-${index}`);

  return {
    goal: { dailyMinutes: 30, kind: "explain", targetDate: fromIsoDate("2020-09-30") },
    graph: {
      phases: [{ milestone: null, name: "Everything" }],
      skills: ["intro", ...repeated].map((skillId) => ({
        area: null,
        lessons: 1,
        name: skillId,
        outlined: true,
        phase: 0,
        skillId,
        weight: 1,
      })),
    },
    items: [],
    lessons: [
      { chapterId: "c", lessonId: "intro", minutes: 4, skillIds: ["intro"], title: "Intro" },
      ...repeated.map((skillId) => ({
        chapterId: "c",
        lessonId: skillId,
        minutes: 10,
        skillIds: [skillId],
        title: "Same lesson",
      })),
    ],
    mockMinutes: 150,
    mode: "forced",
    paceFactor: 1,
    prerequisites: new Map(),
    readiness: new Map(),
    settings: parsePlanSettings({ startDate: "2020-09-28" }),
    today: fromIsoDate("2020-09-28"),
  };
}

describe("the least time that could cover a goal", () => {
  it("finds what trying every time finds when the least time leaves out a repeated title", () => {
    const input = repeatedTitleInput();

    const fits = (minutes: number) =>
      getSelectedCoverage({
        built: buildPlan(withDailyMinutes(input, minutes)),
        examSubjects: null,
        input,
      })?.fits ?? false;

    expect(findFittingMinutes(fits)).toBe(10);
    expect(getPlanFeasibility({ input }).recommendedMinutes).toBe(10);
  });
});
