import { describe, expect, it } from "vitest";
import { type BuildPlanInput, buildPlan } from "./build-plan";
import { fromIsoDate, toIsoDate } from "./plan-calendar";
import { type ExistingPlanItem } from "./plan-items";
import { parsePlanSettings } from "./plan-state";

const TODAY = fromIsoDate("2026-11-08");
const DAILY_MINUTES = 15;
const LESSON_MINUTES = [5, 3, 3, 3, 4, 3, 3, 4, 5, 3];

const INPUT: BuildPlanInput = {
  goal: { dailyMinutes: DAILY_MINUTES, kind: "learn", targetDate: null },
  graph: {
    phases: [{ milestone: null, name: "What a stock is" }],
    skills: [
      {
        area: "Stocks",
        lessons: LESSON_MINUTES.length,
        name: "Explain what a share is",
        phase: 0,
        skillId: "shares",
        topics: [],
        weight: 1,
      },
    ],
  },
  items: [],
  lessons: LESSON_MINUTES.map((minutes, index) => ({
    chapterId: "shares",
    lessonId: `lesson-${index + 1}`,
    minutes,
    skillIds: ["shares"],
    title: `Lesson ${index + 1}`,
  })),
  mockMinutes: 15,
  mode: "forced",
  paceFactor: 1,
  prerequisites: new Map(),
  readiness: new Map(),
  settings: parsePlanSettings({ startDate: toIsoDate(TODAY) }),
  today: TODAY,
};

function todayLessons(plan: ReturnType<typeof buildPlan>) {
  return plan.items.filter(
    (item) => item.kind === "lesson" && item.scheduledFor?.getTime() === TODAY.getTime(),
  );
}

function sumMinutes(items: readonly { minutes: number }[]): number {
  return items.reduce((total, item) => total + item.minutes, 0);
}

describe("a lesson finished today before the plan is laid out again", () => {
  it("takes its minutes from today's time instead of adding a day's worth on top", () => {
    const first = buildPlan(INPUT);
    const planned = sumMinutes(todayLessons(first));

    expect(todayLessons(first).map((item) => item.lessonId)).toContain("lesson-1");
    expect(planned).toBeLessThanOrEqual(DAILY_MINUTES);

    const saved: ExistingPlanItem[] = first.items.map((item, position) => ({
      ...item,
      completedAt: item.lessonId === "lesson-1" ? TODAY : null,
      id: `item-${position}`,
      position,
      status: item.lessonId === "lesson-1" ? "done" : "todo",
    }));

    const again = buildPlan({ ...INPUT, items: saved });
    const today = todayLessons(again);

    expect(today.map((item) => item.lessonId)).toContain("lesson-1");
    expect(today.length).toBeGreaterThan(1);
    expect(sumMinutes(today)).toBeLessThanOrEqual(planned + 0.01);
    expect(sumMinutes(today)).toBeGreaterThan(planned - Math.max(...LESSON_MINUTES));
  });
});
