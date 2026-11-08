import { describe, expect, it } from "vitest";
import { type PlanDayView, type PlanItemView } from "../../../plans/plan-view-contract";
import { composeRevealDays } from "./compose-reveal";

function lesson(id: string, extra: Partial<PlanItemView> = {}): PlanItemView {
  return {
    chapterId: null,
    id,
    kind: "lesson",
    lessonId: `lesson-${id}`,
    minutes: 5,
    requiresPlus: false,
    scheduledFor: null,
    skillId: null,
    status: "todo",
    title: id,
    writing: false,
    ...extra,
  };
}

function day(date: string, items: PlanItemView[], minutes = 15): PlanDayView {
  return { date, items, minutes, mockFunding: null, state: "upcoming" };
}

const block = (
  lessonId: string | null,
  estimatedMinutes: number,
  chapterId: string | null = null,
) => ({ chapterId, estimatedMinutes, lessonId });

describe(composeRevealDays, () => {
  it("moves a lesson Today leaves out to tomorrow and lists each lesson once after that", () => {
    const days = [
      day("2026-11-08", [lesson("a"), lesson("b"), lesson("split")]),
      day("2026-11-09", [lesson("split"), lesson("c")]),
      day("2026-11-10", [lesson("c"), lesson("d")]),
      day("2026-11-11", [], 0),
    ];

    const reveal = composeRevealDays({ blocks: [block("lesson-a", 7), block(null, 9)], days });

    expect(reveal.nextDays.map(({ items }) => items.map(({ id }) => id))).toStrictEqual([
      ["b", "split", "c"],
      ["d"],
      [],
    ]);
  });

  it("drops what Today lists from the days after it, and a day left with nothing to list", () => {
    const days = [
      day("2026-11-08", [lesson("a")]),
      day("2026-11-09", [lesson("a"), lesson("b")]),
      day("2026-11-10", [lesson("b")]),
      day("2026-11-11", [], 0),
    ];

    const reveal = composeRevealDays({ blocks: [block("lesson-a", 4)], days });

    expect(
      reveal.nextDays.map(({ date, items }) => [date, items.map(({ id }) => id)]),
    ).toStrictEqual([
      ["2026-11-09", ["b"]],
      ["2026-11-11", []],
    ]);
  });

  it("counts Today's minutes from what it lists, and the week's study days with their time", () => {
    const days = [
      day("2026-11-08", [lesson("a")], 15),
      day("2026-11-09", [lesson("b")], 15),
      day("2026-11-10", [], 0),
    ];

    const reveal = composeRevealDays({
      blocks: [block("lesson-a", 7), block(null, 2), block(null, 9)],
      days,
    });

    expect({ minutes: reveal.minutes, week: reveal.week }).toStrictEqual({
      minutes: 18,
      week: { days: 2, minutes: 30 },
    });
  });

  it("matches a lesson still being written by its chapter, and never moves a finished one", () => {
    const days = [
      day("2026-11-08", [
        lesson("standIn", { chapterId: "chapter-1", kind: "chapter", lessonId: null }),
        lesson("finished", { status: "done" }),
      ]),
      day("2026-11-09", []),
    ];

    const reveal = composeRevealDays({ blocks: [block(null, 5, "chapter-1")], days });

    expect(reveal.nextDays).toStrictEqual([]);
  });
});
