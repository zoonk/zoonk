import { describe, expect, it } from "vitest";
import { type BuildPlanInput, buildPlan } from "./build-plan";
import { fromIsoDate } from "./plan-calendar";
import { parsePlanSettings } from "./plan-state";

function input(): BuildPlanInput {
  return {
    goal: { dailyMinutes: 20, kind: "learn", targetDate: null },
    graph: {
      phases: [{ milestone: null, name: "Basics" }],
      skills: ["first", "second"].map((skillId) => ({
        area: null,
        lessons: 1,
        name: skillId,
        phase: 0,
        skillId,
        weight: null,
      })),
    },
    items: [],
    lessons: ["first", "second"].map((skillId, position) => ({
      chapterId: "chapter",
      courseOrder: { phase: 0, position },
      lessonId: skillId,
      minutes: 4,
      skillIds: [skillId],
      title: skillId,
    })),
    mockMinutes: 150,
    mode: "forced",
    paceFactor: 1,
    prerequisites: new Map(),
    readiness: new Map(),
    settings: parsePlanSettings({ startDate: "2026-11-13" }),
    today: fromIsoDate("2026-11-13"),
  };
}

describe("corrected curriculum planning", () => {
  it("drops a held unfinished lesson removed from its course's curriculum", () => {
    const before = input();
    const built = buildPlan(before);

    const items = built.items.map((item, position) => ({
      ...item,
      id: `held-${position}`,
      position,
    }));

    const after = buildPlan({
      ...before,
      items,
      lessons: before.lessons.filter((lesson) => lesson.lessonId !== "first"),
      mode: "automatic",
    });

    expect(after.items.filter((item) => item.lessonId === "first")).toStrictEqual([]);
  });

  it("uses corrected course order at the next full planning write", () => {
    const before = input();

    const after = buildPlan({
      ...before,
      lessons: before.lessons.map((lesson, position) => ({
        ...lesson,
        courseOrder: { phase: 0, position: 1 - position },
      })),
    });

    expect(after.items.flatMap((item) => item.lessonId ?? [])).toStrictEqual(["second", "first"]);
  });

  it("honors a corrected prerequisite before the dependent skill", () => {
    const original = input();

    const before: BuildPlanInput = {
      ...original,
      goal: { dailyMinutes: 4, kind: "exam", targetDate: fromIsoDate("2027-01-13") },
      graph: {
        ...original.graph,
        skills: original.graph.skills.map((skill, index) => ({
          ...skill,
          area: skill.skillId,
          weight: index === 0 ? 1 : 5,
        })),
      },
      lessons: original.lessons.map(({ courseOrder: _order, ...lesson }) => lesson),
    };

    const after = buildPlan({ ...before, prerequisites: new Map([["second", ["first"]]]) });
    expect(after.items.flatMap((item) => item.lessonId ?? [])).toStrictEqual(["first", "second"]);
  });
});
