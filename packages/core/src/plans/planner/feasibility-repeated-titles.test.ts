import { describe, expect, it } from "vitest";
import { type BuildPlanInput, buildPlan } from "./build-plan";
import { fromIsoDate } from "./plan-calendar";
import { getPlanFeasibility } from "./plan-feasibility";
import { parsePlanSettings } from "./plan-state";
import { summarizeSelectedPlan } from "./selected-plan-summary";

function repeatedTitleInput(): BuildPlanInput {
  return {
    goal: { dailyMinutes: 30, kind: "learn", targetDate: fromIsoDate("2020-10-26") },
    graph: {
      phases: [{ milestone: null, name: "Physics" }],
      skills: ["physics", "enem"].map((skillId) => ({
        area: "Physics",
        lessons: 2,
        name: skillId,
        outlined: true,
        phase: 0,
        skillId,
        weight: 1,
      })),
    },
    items: [],
    lessons: [
      {
        chapterId: "physics",
        lessonId: "physics-ohm",
        minutes: 10,
        skillIds: ["physics"],
        title: "Lei de Ohm",
      },
      {
        chapterId: "physics",
        lessonId: "physics-power",
        minutes: 10,
        skillIds: ["physics"],
        title: "Potência",
      },
      {
        chapterId: "enem",
        lessonId: "enem-ohm",
        minutes: 12,
        skillIds: ["enem"],
        title: "lei de ohm ",
      },
      {
        chapterId: "enem",
        lessonId: "enem-circuits",
        minutes: 10,
        skillIds: ["enem"],
        title: "Circuitos",
      },
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

describe("repeated-title feasibility", () => {
  it("covers everything when the plan teaches a repeated title once", () => {
    const input = repeatedTitleInput();
    const built = buildPlan(input);
    const lessonIds = built.items.flatMap((item) => (item.lessonId ? [item.lessonId] : []));

    expect(lessonIds.toSorted()).toStrictEqual(["enem-circuits", "physics-ohm", "physics-power"]);

    const feasibility = getPlanFeasibility({ input, planned: built });

    expect(feasibility.skillFits).toStrictEqual(
      new Map([
        ["physics", 1],
        ["enem", 1],
      ]),
    );

    expect(feasibility.fits).toBe(true);
    expect(feasibility.coveredShare).toBe(1);
  });

  it("keeps a shown lesson once when a later outline puts its duplicate first", () => {
    const input = repeatedTitleInput();
    const first = buildPlan({ ...input, lessons: input.lessons.slice(0, 2) });

    const updated = buildPlan({
      ...input,
      graph: { ...input.graph, skills: input.graph.skills.toReversed() },
      items: first.items.map((item, position) => ({ ...item, id: `saved-${position}`, position })),
      mode: "automatic",
    });

    expect(
      updated.items.filter(
        (item) => item.lessonId === "physics-ohm" || item.lessonId === "enem-ohm",
      ),
    ).toHaveLength(1);

    expect(updated.items.some((item) => item.lessonId === "physics-ohm")).toBe(true);
  });

  it("counts a repeated title's minutes once in what the plan requires", () => {
    const input = repeatedTitleInput();
    const built = buildPlan(input);
    const summary = summarizeSelectedPlan({ built, examSubjects: null, input });

    expect(summary.requirement.totalRaw).toBe(30);
  });
});
