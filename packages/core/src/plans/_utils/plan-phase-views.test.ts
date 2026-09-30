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

    expect(view?.chapters?.map((chapter) => [chapter.title, chapter.state])).toStrictEqual([
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

    expect(view?.chapters?.map(({ title, writing }) => ({ title, writing }))).toStrictEqual([
      { title: "What you own when you buy a share", writing: false },
      { title: "Stock market", writing: true },
      { title: "", writing: true },
    ]);

    expect(view?.chapterCount).toBe(3);
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
});
