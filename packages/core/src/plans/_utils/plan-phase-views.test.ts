import { describe, expect, it } from "vitest";
import { type ExistingPlanItem } from "../planner/plan-items";
import { type PlanPhase } from "../planner/plan-state";
import { buildPhaseViews, findCurrentPhase } from "./plan-phase-views";

function phase(attrs: Partial<PlanPhase> = {}): PlanPhase {
  return {
    endDate: null,
    kind: "learn",
    milestone: null,
    minutes: 0,
    name: "Phase",
    startDate: null,
    ...attrs,
  };
}

function lesson(position: number, phaseIndex: number): ExistingPlanItem {
  return {
    chapterId: null,
    completedAt: null,
    id: `item-${position}`,
    kind: "lesson",
    lessonId: null,
    phase: phaseIndex,
    position,
    scheduledFor: null,
    skillId: `skill-${position}`,
    status: "todo",
    titleSnapshot: `Lesson ${position}`,
  };
}

function chapterLesson(position: number, chapterId: string, status: "done" | "todo") {
  return { ...lesson(position, 0), chapterId, status };
}

describe(buildPhaseViews, () => {
  const items = [lesson(0, 0), lesson(1, 0), lesson(2, 0), lesson(3, 1)];

  it("uses the planner's minutes for each phase", () => {
    const views = buildPhaseViews({
      chapterTitles: new Map(),
      currentPhase: 0,
      estimateMinutes: 600,
      items,
      phases: [phase({ minutes: 90 }), phase({ minutes: 30 })],
      skillAreas: new Map(),
    });

    expect(views.map((view) => view.hours)).toStrictEqual([1.5, 0.5]);
  });

  it("shares the plan's estimate by lessons when a phase was saved without minutes", () => {
    const views = buildPhaseViews({
      chapterTitles: new Map(),
      currentPhase: 0,
      estimateMinutes: 240,
      items,
      phases: [phase(), phase()],
      skillAreas: new Map(),
    });

    expect(views.map((view) => view.hours)).toStrictEqual([3, 1]);
  });

  it("marks a chapter finished after the current one as done", () => {
    const [view] = buildPhaseViews({
      chapterTitles: new Map([
        ["a", "Percentages"],
        ["b", "Reading"],
        ["c", "Ecology"],
      ]),
      currentPhase: 0,
      items: [
        chapterLesson(0, "a", "done"),
        chapterLesson(1, "b", "done"),
        chapterLesson(2, "a", "todo"),
        chapterLesson(3, "c", "todo"),
      ],
      phases: [phase()],
      skillAreas: new Map(),
    });

    expect(view?.chapters.map((chapter) => [chapter.title, chapter.state])).toStrictEqual([
      ["Percentages", "current"],
      ["Reading", "done"],
      ["Ecology", "upcoming"],
    ]);
  });

  it("shows skills still being written under their course, never their raw names", () => {
    const [view] = buildPhaseViews({
      chapterTitles: new Map([["a", "What you own when you buy a share"]]),
      currentPhase: 0,
      items: [
        chapterLesson(0, "a", "todo"),
        { ...lesson(1, 0), titleSnapshot: "Distinguish share issuance from trading" },
        { ...lesson(2, 0), titleSnapshot: "Explain market liquidity" },
        { ...lesson(3, 0), skillId: "skill-unknown", titleSnapshot: "Read an order book" },
      ],
      phases: [phase()],
      skillAreas: new Map([
        ["skill-1", "Stock market"],
        ["skill-2", "Stock market"],
      ]),
    });

    expect(view?.chapters.map(({ title, writing }) => ({ title, writing }))).toStrictEqual([
      { title: "What you own when you buy a share", writing: false },
      { title: "Stock market", writing: true },
      { title: "", writing: true },
    ]);

    expect(view?.chapterCount).toBe(3);
  });

  it("lists every phase's chapters, with a current one only in the current phase", () => {
    const views = buildPhaseViews({
      chapterTitles: new Map([
        ["a", "Percentages"],
        ["b", "Circuits"],
        ["c", "Ecology"],
        ["d", "Functions"],
      ]),
      currentPhase: 1,
      items: [
        chapterLesson(0, "a", "done"),
        { ...chapterLesson(1, "b", "todo"), phase: 1 },
        { ...chapterLesson(2, "c", "todo"), phase: 1 },
        { ...chapterLesson(3, "d", "todo"), phase: 2 },
      ],
      phases: [phase(), phase(), phase()],
      skillAreas: new Map(),
    });

    expect(
      views.map((view) => view.chapters.map((chapter) => [chapter.title, chapter.state])),
    ).toStrictEqual([
      [["Percentages", "done"]],
      [
        ["Circuits", "current"],
        ["Ecology", "upcoming"],
      ],
      [["Functions", "upcoming"]],
    ]);
  });

  it("closes each phase with its checkpoint, done once passed", () => {
    const boss = (position: number, phaseIndex: number, status: "done" | "todo") => ({
      ...lesson(position, phaseIndex),
      kind: "boss" as const,
      scheduledFor: new Date("2026-10-16T00:00:00.000Z"),
      skillId: null,
      status,
    });

    const views = buildPhaseViews({
      chapterTitles: new Map(),
      currentPhase: 1,
      items: [lesson(0, 0), boss(1, 0, "done"), lesson(2, 1), boss(3, 1, "todo"), lesson(4, 2)],
      phases: [phase(), phase(), phase()],
      skillAreas: new Map(),
    });

    expect(views.map((view) => view.checkpoint)).toStrictEqual([
      { date: "2026-10-16", planItemId: "item-1", state: "done" },
      { date: "2026-10-16", planItemId: "item-3", state: "upcoming" },
      null,
    ]);
  });
});

describe("a phase's mock exams", () => {
  it("counts them and says when the next one still to take is", () => {
    const mock = (position: number, day: string, status: "done" | "todo") => ({
      ...lesson(position, 1),
      kind: "mock" as const,
      scheduledFor: new Date(`${day}T00:00:00.000Z`),
      skillId: null,
      status,
    });

    const views = buildPhaseViews({
      chapterTitles: new Map(),
      currentPhase: 1,
      items: [
        lesson(0, 0),
        mock(1, "2026-11-02", "done"),
        mock(2, "2026-11-16", "todo"),
        mock(3, "2026-11-09", "todo"),
      ],
      phases: [phase(), phase()],
      skillAreas: new Map(),
    });

    expect(views.map((view) => view.mocks)).toStrictEqual([
      { count: 0, nextDate: null },
      { count: 3, nextDate: "2026-11-09" },
    ]);
  });
});

describe(findCurrentPhase, () => {
  it("is the phase of the next written lesson, not of a stand-in still waiting for its lessons", () => {
    const items = [
      { ...lesson(0, 0), lessonId: "done", status: "done" as const },
      lesson(1, 0),
      { ...lesson(2, 1), lessonId: "written" },
    ];

    expect(findCurrentPhase({ items, phaseCount: 2 })).toBe(1);
  });

  it("falls back to the first stand-in when nothing written is left", () => {
    expect(findCurrentPhase({ items: [lesson(0, 0), lesson(1, 1)], phaseCount: 2 })).toBe(0);
  });

  it("stays at the stand-ins before a mock, such as a test days away whose lessons are being written", () => {
    // Day 1 and day 2's lessons are still being written; day 3 is the short mock.
    const mock = { ...lesson(4, 2), kind: "mock" as const, skillId: null };
    const items = [lesson(0, 0), lesson(1, 0), lesson(2, 1), lesson(3, 1), mock];

    expect(findCurrentPhase({ items, phaseCount: 3 })).toBe(0);
  });

  it("is at a phase's checkpoint once its lessons are done, before the next phase's lessons", () => {
    const checkpoint = { ...lesson(1, 0), kind: "boss" as const, skillId: null };
    const items = [{ ...lesson(0, 0), lessonId: "done", status: "done" as const }, checkpoint];

    expect(
      findCurrentPhase({ items: [...items, { ...lesson(2, 1), lessonId: "w" }], phaseCount: 2 }),
    ).toBe(0);
  });
});
