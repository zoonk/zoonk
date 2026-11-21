import { describe, expect, it } from "vitest";
import { type BuildPlanInput, buildPlan } from "./build-plan";
import { fromIsoDate, toIsoDate } from "./plan-calendar";
import { type ExistingPlanItem } from "./plan-items";
import { parsePlanSettings } from "./plan-state";

const TODAY = fromIsoDate("2026-10-01");

function lesson(lessonId: string, skillId: string) {
  return {
    chapterId: `chapter-${skillId}`,
    lessonId,
    minutes: 4,
    skillIds: [skillId],
    title: lessonId,
  };
}

function saved(lessonId: string, skillId: string, attrs: Partial<ExistingPlanItem>) {
  return {
    chapterId: `chapter-${skillId}`,
    completedAt: null,
    id: lessonId,
    kind: "lesson" as const,
    lessonId,
    phase: 0,
    position: 0,
    scheduledFor: null,
    skillId,
    status: "todo" as const,
    titleSnapshot: lessonId,
    ...attrs,
  };
}

/** The saved plan still dates B's lessons, but today's re-plan no longer plans skill B at all. */
function comeBack(openedKeys: string[]): BuildPlanInput {
  const items = [
    saved("a1", "A", {
      completedAt: fromIsoDate("2026-09-29"),
      scheduledFor: fromIsoDate("2026-09-29"),
      status: "done",
    }),
    saved("b1", "B", { scheduledFor: fromIsoDate("2026-09-30") }),
    saved("a2", "A", { scheduledFor: TODAY }),
    saved("b2", "B", { scheduledFor: fromIsoDate("2026-10-02") }),
    saved("a3", "A", { scheduledFor: fromIsoDate("2026-10-03") }),
  ].map((item, position) => ({ ...item, position }));

  return {
    goal: { dailyMinutes: 20, kind: "learn", targetDate: null },
    graph: {
      phases: [{ milestone: null, name: "Only" }],
      skills: [{ area: null, lessons: 3, name: "A", phase: 0, skillId: "A", weight: null }],
    },
    items,
    lessons: [
      lesson("a1", "A"),
      lesson("b1", "B"),
      lesson("a2", "A"),
      lesson("b2", "B"),
      lesson("a3", "A"),
    ],
    mockMinutes: 150,
    mode: "forced",
    openedKeys,
    paceFactor: 1,
    prerequisites: new Map(),
    readiness: new Map(),
    setAsideLeftWork: true,
    settings: parsePlanSettings({ startDate: "2026-09-29" }),
    today: TODAY,
    todayShown: true,
  };
}

function statusOf(built: ReturnType<typeof buildPlan>, key: string) {
  const item = built.items.find((entry) => entry.key === key);
  return item ? [item.status, item.scheduledFor && toIsoDate(item.scheduledFor)] : null;
}

describe("the day the learner opened", () => {
  it.each([
    {
      name: "a day with left work and a later lesson",
      opened: ["lesson:b1", "lesson:a2", "lesson:b2"],
    },
    { name: "a light welcome-back day of left work", opened: ["lesson:b1"] },
  ])(
    "stays whole on today even when the re-plan no longer plans its lessons ($name)",
    ({ opened }) => {
      const built = buildPlan(comeBack(opened));

      expect(opened.map((key) => statusOf(built, key))).toStrictEqual(
        opened.map(() => ["todo", "2026-10-01"]),
      );
    },
  );
});
