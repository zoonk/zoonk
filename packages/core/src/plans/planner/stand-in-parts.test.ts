import { describe, expect, it } from "vitest";
import { fromIsoDate } from "./plan-calendar";
import { DEFAULT_LESSON_MINUTES, type QueueUnit } from "./plan-units";
import { joinStandIns, splitStandIns } from "./stand-in-parts";

const PACE = 1.5;

const standIn: QueueUnit = {
  area: "English",
  chapterId: null,
  key: "skill:order",
  kind: "lesson",
  lessonId: null,
  lessons: 45,
  minutes: 45 * DEFAULT_LESSON_MINUTES * PACE,
  phase: 0,
  skillId: "order",
  title: "Ordering food",
};

describe(splitStandIns, () => {
  it("splits a stand-in into one part per lesson at the learner's pace", () => {
    const parts = splitStandIns([standIn]);

    expect(parts).toHaveLength(45);
    expect(parts.every((part) => part.lessons === 1)).toBe(true);
    expect(parts[0]?.minutes).toBeCloseTo(DEFAULT_LESSON_MINUTES * PACE);
  });
});

describe(joinStandIns, () => {
  it("joins scheduled parts back into one item holding every lesson and minute", () => {
    const parts: (QueueUnit & { date: Date; studyMinutes: number; teachingEnd?: Date })[] =
      splitStandIns([standIn]).map((part, index) => ({
        ...part,
        date: fromIsoDate(index < 20 ? "2026-11-23" : "2026-12-07"),
        studyMinutes: part.minutes,
      }));

    const [joined, ...rest] = joinStandIns(parts);

    expect(rest).toStrictEqual([]);
    expect(joined?.lessons).toBe(45);
    expect(joined?.minutes).toBeCloseTo(standIn.minutes);
    expect(joined?.date).toStrictEqual(fromIsoDate("2026-11-23"));
    expect(joined?.teachingEnd).toStrictEqual(fromIsoDate("2026-12-07"));
  });
});
