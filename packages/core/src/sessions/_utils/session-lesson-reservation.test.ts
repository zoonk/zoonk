import { describe, expect, it } from "vitest";
import { getSessionLessonReservation } from "./session-lesson-reservation";
import { type SessionPlanItem } from "./session-plan-item";

const TODAY = new Date("2026-11-21T00:00:00Z");
const BEFORE_BREAK = new Date("2026-11-09T00:00:00Z");

const graph = {
  phases: [],
  skills: [
    { area: null, lessons: 4, name: "Housing", phase: 1, skillId: "housing", weight: 1 },
    { area: null, lessons: 108, name: "Work", phase: 3, skillId: "work", weight: 1 },
  ],
};

function lesson(position: number, overrides: Partial<SessionPlanItem> = {}): SessionPlanItem {
  return {
    chapterId: null,
    completedAt: null,
    facts: null,
    id: `item-${position}`,
    kind: "lesson",
    lessonId: `lesson-${position}`,
    lessons: null,
    minutes: 6,
    phase: 1,
    position,
    scheduledFor: BEFORE_BREAK,
    skillId: "housing",
    status: "todo",
    titleSnapshot: `Lesson ${position}`,
    ...overrides,
  };
}

const laterPhase = lesson(9, {
  facts: {
    days: [["2026-11-21", 25, 12.5]],
    minutes: 864,
    parts: { checkpoint: 0, practice: 432, unwritten: 432, written: 0 },
    schemaVersion: 1,
    skillIds: ["work"],
  },
  lessonId: null,
  lessons: 108,
  minutes: 864,
  phase: 3,
  skillId: "work",
  titleSnapshot: "Introducing yourself at work",
});

const review = { estimatedMinutes: 2, lessonId: null, payload: {}, status: "pending" as const };

function reserve(items: SessionPlanItem[]) {
  return getSessionLessonReservation({
    access: { includesMockExams: true },
    plan: { graph, items, settings: {} },
    session: {
      blocks: [review],
      freshStart: "welcomeBack",
      goal: { dailyMinutes: 25, kind: "learn", targetDate: null },
      localDate: TODAY,
      plannedMinutes: 10,
    },
  });
}

describe(getSessionLessonReservation, () => {
  it("holds no lesson a later phase is waiting on while written lessons come first", () => {
    expect(reserve([lesson(1), lesson(2), lesson(3), laterPhase])).toStrictEqual({
      lessonPlaceholder: null,
      lessonRoom: true,
      unwrittenRoom: false,
    });
  });

  it("waits on an unwritten lesson when it's the next one the day reaches", () => {
    expect(reserve([laterPhase])).toStrictEqual({
      lessonPlaceholder: { minutes: 12.5, title: "Introducing yourself at work" },
      lessonRoom: true,
      unwrittenRoom: true,
    });
  });
});
