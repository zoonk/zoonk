import { describe, expect, it } from "vitest";
import { buildPlan } from "./build-plan";
import { addDays, fromIsoDate, toIsoDate } from "./plan-calendar";
import { type ExistingPlanItem } from "./plan-items";
import { type PlanGraphSkill, parsePlanSettings } from "./plan-state";
import { type PlannerLesson } from "./plan-units";

const TODAY = fromIsoDate("2026-10-12");

function skill(skillId: string): PlanGraphSkill {
  return { area: null, lessons: 2, name: skillId, phase: 0, skillId, weight: null };
}

function lesson(lessonId: string, skillId: string): PlannerLesson {
  return { chapterId: skillId, lessonId, minutes: 4, skillIds: [skillId], title: lessonId };
}

function todo({
  day,
  lessonId,
  position,
  skillId,
}: {
  day: number;
  lessonId: string;
  position: number;
  skillId: string;
}): ExistingPlanItem {
  return {
    chapterId: skillId,
    completedAt: null,
    id: lessonId,
    kind: "lesson",
    lessonId,
    phase: 0,
    position,
    scheduledFor: addDays(TODAY, day),
    skillId,
    status: "todo",
    titleSnapshot: lessonId,
  };
}

describe("a new day's settling of a lesson whose base the learner hasn't begun", () => {
  it("carries the lesson in after the base's first lesson instead of first", () => {
    const plan = buildPlan({
      carryOver: { lessonIds: [] },
      goal: { dailyMinutes: 12, kind: "learn", targetDate: null },
      graph: {
        phases: [{ milestone: null, name: "Only" }],
        skills: [skill("base"), skill("built")],
      },
      items: [
        todo({ day: -1, lessonId: "built-1", position: 0, skillId: "built" }),
        todo({ day: 1, lessonId: "base-1", position: 1, skillId: "base" }),
        todo({ day: 1, lessonId: "base-2", position: 2, skillId: "base" }),
        todo({ day: 2, lessonId: "built-2", position: 3, skillId: "built" }),
      ],
      lessons: [
        lesson("base-1", "base"),
        lesson("base-2", "base"),
        lesson("built-1", "built"),
        lesson("built-2", "built"),
      ],
      mockMinutes: 150,
      mode: "forced",
      paceFactor: 1,
      prerequisites: new Map([["built", ["base"]]]),
      readiness: new Map(),
      settings: parsePlanSettings({ startDate: toIsoDate(addDays(TODAY, -3)) }),
      today: TODAY,
    });

    const lessons = plan.items.filter((item) => item.kind === "lesson");

    expect(lessons.map((item) => item.key)).toStrictEqual([
      "lesson:base-1",
      "lesson:base-2",
      "lesson:built-1",
      "lesson:built-2",
    ]);

    expect(lessons[0]?.scheduledFor).toStrictEqual(TODAY);
  });
});
