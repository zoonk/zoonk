import { describe, expect, it } from "vitest";
import { getLessonLookahead, pickDayLessonItems } from "./day-lessons";

const TODAY = new Date("2026-10-06T00:00:00Z");
const TOMORROW = new Date("2026-10-07T00:00:00Z");

const graph = {
  phases: [],
  skills: [
    { area: "Língua Portuguesa", lessons: 4, name: "Ler", phase: 0, skillId: "reading", weight: 5 },
    {
      area: "Direito Constitucional",
      lessons: 4,
      name: "Princípios",
      phase: 0,
      skillId: "principles",
      weight: 4,
    },
    { area: "Língua Inglesa", lessons: 4, name: "Read", phase: 0, skillId: "english", weight: 3 },
  ],
};

function item(id: string, skillId: string, scheduledFor: Date | null) {
  return { chapterId: null, id, lessonId: `lesson-${id}`, scheduledFor, skillId };
}

const items = [
  item("pt-1", "reading", TODAY),
  item("cf-1", "principles", TODAY),
  item("en-1", "english", TOMORROW),
  item("pt-2", "reading", TOMORROW),
  item("cf-2", "principles", TOMORROW),
];

describe(pickDayLessonItems, () => {
  it("fills an exam day with today's lessons, then more of today's subjects, not tomorrow's", () => {
    const picked = pickDayLessonItems({ graph, isExam: true, items, today: TODAY });

    expect(picked.map((entry) => entry.id)).toStrictEqual(["pt-1", "cf-1", "pt-2", "cf-2"]);
  });

  it("keeps the time of today's lessons still being outlined instead of reaching past them", () => {
    const waiting = [
      item("pt-1", "reading", TODAY),
      { ...item("cf-1", "principles", TODAY), lessonId: null },
      ...items.slice(2),
    ];

    expect(
      [true, false].map((isExam) =>
        pickDayLessonItems({ graph, isExam, items: waiting, today: TODAY }).map(
          (entry) => entry.id,
        ),
      ),
    ).toStrictEqual([["pt-1"], ["pt-1"]]);
  });

  it("reaches past stand-ins due later, which have nothing to open yet", () => {
    const waiting = [{ ...item("en-0", "english", TOMORROW), lessonId: null }, ...items];

    expect(
      pickDayLessonItems({ graph, isExam: false, items: waiting, today: TODAY }),
    ).toStrictEqual(items);
  });

  it("follows the plan's order for other goals and on a day with nothing due", () => {
    expect(pickDayLessonItems({ graph, isExam: false, items, today: TODAY })).toStrictEqual(items);

    const later = items.filter((entry) => entry.scheduledFor === TOMORROW);

    expect(pickDayLessonItems({ graph, isExam: true, items: later, today: TODAY })).toStrictEqual(
      later,
    );
  });
});

describe(getLessonLookahead, () => {
  it("looks ahead at a lesson for every few minutes of the day, and at least eight", () => {
    expect([15, 30, 120, 240].map((minutes) => getLessonLookahead(minutes))).toStrictEqual([
      8, 8, 30, 60,
    ]);
  });
});
