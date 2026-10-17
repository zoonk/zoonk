import { describe, expect, it } from "vitest";
import { type BuildPlanInput, buildPlan } from "../planner/build-plan";
import { fromIsoDate } from "../planner/plan-calendar";
import { parsePlanSettings } from "../planner/plan-state";
import { listSelectedItemFacts } from "../planner/selected-item-facts";
import { summarizeSelectedPlan } from "../planner/selected-plan-summary";
import { summarizeRetainedPlan } from "./retained-plan-allocation";
import { readSelectedItemFacts, withSelectedItemFacts } from "./selected-item-contract";

function setup() {
  const input: BuildPlanInput = {
    goal: { dailyMinutes: 30, kind: "learn", targetDate: fromIsoDate("2026-10-01") },
    graph: {
      phases: [{ milestone: null, name: "Light" }],
      skills: [{ area: null, lessons: 1, name: "Light", phase: 0, skillId: "light", weight: 1 }],
    },
    items: [],
    lessons: [
      { chapterId: "chapter", lessonId: "lesson", minutes: 3, skillIds: ["light"], title: "Light" },
    ],
    mockMinutes: 150,
    mode: "forced",
    paceFactor: 1,
    prerequisites: new Map(),
    readiness: new Map(),
    settings: parsePlanSettings({ startDate: "2026-09-30" }),
    today: fromIsoDate("2026-09-30"),
  };

  const built = buildPlan(input);
  const facts = listSelectedItemFacts({ built, input });

  const items = withSelectedItemFacts({ facts, items: built.items }).map((item, position) => ({
    ...item,
    facts:
      item.lessonId === "lesson"
        ? {
            ...readSelectedItemFacts(item.facts),
            days: [
              ["2026-09-30", 1, 0.5],
              ["2026-10-01", 5, 2.5],
            ] as [string, number, number][],
            minutes: 6,
            parts: { checkpoint: 0, practice: 3, unwritten: 0, written: 3 },
            teachingEnd: "2026-10-01",
          }
        : item.facts,
    id: `saved-${position}`,
    minutes: item.lessonId === "lesson" ? 6 : item.minutes,
    position,
  }));

  return { built, context: { items, phases: built.phases }, input };
}

describe("summary of an unchanged saved allocation", () => {
  it("keeps the saved raw day portions and teaching end instead of copying the candidate's earlier dates", () => {
    const { built, context, input } = setup();
    const candidate = summarizeSelectedPlan({ built, examSubjects: null, input });
    expect(candidate.coverage?.coveredShare).toBe(1);

    const before = structuredClone(context);
    const summary = summarizeRetainedPlan({ built, context, examSubjects: null, input });

    if (!summary) {
      throw new Error("Expected validated saved allocation facts");
    }

    expect(summary.coverage?.coveredShare).toBe(0.5 / 3);
    expect(summary.coverage?.fits).toBe(false);
    expect(summary.endDate).toBe("2026-10-01");

    expect(context).toStrictEqual(before);
  });

  it("does not claim a fresh summary for legacy rows without validated allocation facts", () => {
    const { built, context, input } = setup();

    expect(
      summarizeRetainedPlan({
        built,
        context: { ...context, items: context.items.map((item) => ({ ...item, facts: null })) },
        examSubjects: null,
        input,
      }),
    ).toBeNull();
  });
});
