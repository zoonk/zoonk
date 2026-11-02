import { describe, expect, it } from "vitest";
import { buildPlan } from "./build-plan";
import { addDays, fromIsoDate, toIsoDate } from "./plan-calendar";
import { type ExistingPlanItem } from "./plan-items";
import { type PlanGraphSkill, parsePlanSettings } from "./plan-state";
import { type PlannerLesson } from "./plan-units";

const TODAY = fromIsoDate("2026-10-12");

function skill(skillId: string, area: string): PlanGraphSkill {
  return { area, lessons: 2, name: skillId, phase: 0, skillId, weight: null };
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

describe("a focus while today is shown", () => {
  it("gives today's time left to a focused lesson only after what its skill builds on", () => {
    const plan = buildPlan({
      carryOver: { lessonIds: [], todayExceptAreas: [] },
      goal: { dailyMinutes: 30, kind: "learn", targetDate: null },
      graph: {
        phases: [{ milestone: null, name: "Only" }],
        skills: [
          skill("other", "Other"),
          skill("architecture", "Research"),
          skill("content", "Content"),
        ],
      },
      items: [
        todo({ day: 0, lessonId: "other-1", position: 0, skillId: "other" }),
        todo({ day: 1, lessonId: "other-2", position: 1, skillId: "other" }),
        todo({ day: 1, lessonId: "architecture-1", position: 2, skillId: "architecture" }),
        todo({ day: 1, lessonId: "architecture-2", position: 3, skillId: "architecture" }),
        todo({ day: 2, lessonId: "content-1", position: 4, skillId: "content" }),
        todo({ day: 2, lessonId: "content-2", position: 5, skillId: "content" }),
      ],
      lessons: ["other", "architecture", "content"].flatMap((skillId) => [
        lesson(`${skillId}-1`, skillId),
        lesson(`${skillId}-2`, skillId),
      ]),
      mockMinutes: 150,
      mode: "forced",
      paceFactor: 1,
      prerequisites: new Map([["content", ["architecture"]]]),
      readiness: new Map(),
      settings: parsePlanSettings({ focusAreas: ["Content"], startDate: toIsoDate(TODAY) }),
      today: TODAY,
    });

    const dayOf = (key: string) => plan.items.find((item) => item.key === key)?.scheduledFor;

    expect(
      plan.items.filter((item) => item.scheduledFor?.getTime() === TODAY.getTime()),
    ).toMatchObject([{ key: "lesson:other-1" }]);

    expect(dayOf("lesson:architecture-1")?.getTime()).toBeLessThanOrEqual(
      dayOf("lesson:content-1")?.getTime() ?? 0,
    );
  });
});
