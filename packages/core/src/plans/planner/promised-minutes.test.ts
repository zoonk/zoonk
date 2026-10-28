import { describe, expect, it } from "vitest";
import { keepWindowTeaching } from "./kept-teaching";
import { fundMocks } from "./mock-funding";
import { addDays, fromIsoDate, toIsoDate } from "./plan-calendar";
import { type QueueUnit } from "./plan-units";
import {
  type PromisedLesson,
  findPromisedLesson,
  listPromisedLessonMinutes,
} from "./promised-minutes";
import { type DayShape, type FixedEvent, type PlanDay, getLessonCapacity } from "./schedule-units";

/** The day the learner opens the plan: the run starts here. */
const MONDAY = fromIsoDate("2026-10-12");
const THURSDAY = "2026-10-15";

function boss(minutes: number): FixedEvent {
  return { key: "boss:0", kind: "boss", minutes, replacesDay: false, title: "" };
}

function mock(minutes: number): FixedEvent {
  return { key: "mock", kind: "mock", minutes, replacesDay: true, title: "" };
}

/** Days from Monday of 25 minutes, 0.6 of them for lessons, with `shapes` on some of them. */
function listDays(length: number, shapes: Record<string, Partial<DayShape>> = {}): PlanDay[] {
  return Array.from({ length }, (_, offset) => {
    const date = addDays(MONDAY, offset);

    return {
      date,
      shape: {
        events: [],
        minutes: 25,
        open: true,
        phase: 0,
        share: 0.6,
        ...shapes[toIsoDate(date)],
      },
    };
  });
}

function unit(fields: Partial<QueueUnit>): QueueUnit {
  return {
    area: "Linguagens",
    chapterId: "chapter",
    key: "lesson",
    kind: "lesson",
    lessonId: "lesson",
    minutes: 4,
    phase: 0,
    skillId: "skill",
    title: "Lesson",
    ...fields,
  };
}

/** The days with their mocks funded, without saved funding or moves, keeping `promised`'s time. */
function fund(days: readonly PlanDay[], promised: PromisedLesson | null = null) {
  return fundMocks({ days, funding: [], moves: [], promised: keep(days, promised) });
}

/** The teaching funding keeps: the promised lesson's (see `listPromisedLessonMinutes`). */
function keep(days: readonly PlanDay[], promised: PromisedLesson | null) {
  return listPromisedLessonMinutes({ days, promised });
}

/** A day's lesson minutes, on a day of these. */
function getCapacityOn(days: readonly PlanDay[], date: string): number {
  const day = days.find((item) => toIsoDate(item.date) === date);
  return day ? getLessonCapacity(day) : 0;
}

/** What each day keeps from a mock's funding, by date, when its window starts on the first day. */
function listKept(days: readonly PlanDay[], promised: PromisedLesson) {
  const shapes = days.map((day) => day.shape);
  const labels = days.map((day) => toIsoDate(day.date));

  keepWindowTeaching({
    days,
    index: -1,
    labels,
    promised: keep(days, promised),
    shapes,
    windowStart: 0,
  });

  return shapes.flatMap((shape, index) => {
    const day = days[index];
    return shape.kept && day ? [[toIsoDate(day.date), shape.kept] as const] : [];
  });
}

describe(findPromisedLesson, () => {
  it("promises the next lesson of the chapter in progress by the day the learner saw it on", () => {
    const dueBy = fromIsoDate(THURSDAY);

    expect(
      findPromisedLesson({ start: MONDAY, units: [unit({ key: "other" }), unit({ dueBy })] }),
    ).toStrictEqual({ dueBy, key: "lesson", minutes: 4 });
  });

  // Weeks of lessons the Library hasn't written are one stand-in, dated by its first part (see
  // `joinStandIns`): only that part is promised by its day.
  it("promises a stand-in's first part, not the weeks of lessons after it", () => {
    const standIn = unit({ dueBy: fromIsoDate(THURSDAY), lessonId: null, minutes: 40 });

    expect(findPromisedLesson({ start: MONDAY, units: [standIn] })?.minutes).toBe(4);
  });

  it("promises nothing the run doesn't lay out: a day of this week's kept work", () => {
    const dueBy = fromIsoDate(THURSDAY);
    expect(findPromisedLesson({ start: addDays(dueBy, 1), units: [unit({ dueBy })] })).toBeNull();
  });
});

describe(listPromisedLessonMinutes, () => {
  // The day before gives 0.4 of its 20 minutes to lessons, the due day 0.8 of what its 6-minute
  // challenge leaves of its 10: 3.2 lesson minutes there, 4.8 the day before, at each day's share.
  it("keeps the lesson's last minutes up to its day's end, each day's at its own share", () => {
    const days = listDays(4, {
      "2026-10-14": { minutes: 20, share: 0.4 },
      [THURSDAY]: { events: [boss(6)], minutes: 10, share: 0.8 },
    });

    const kept = listKept(days, { dueBy: fromIsoDate(THURSDAY), key: "lesson", minutes: 8 });

    expect(kept.map(([date]) => date)).toStrictEqual(["2026-10-14", THURSDAY]);
    expect(kept[0]?.[1]).toBeCloseTo(12);
    expect(kept[1]?.[1]).toBeCloseTo(4);
  });

  // A first lesson due on the run's first day runs into the next one (see `getDueDay`).
  it("keeps only the first day's time for a lesson due on it", () => {
    const days = listDays(3, { "2026-10-12": { minutes: 5 } });

    expect(listKept(days, { dueBy: MONDAY, key: "lesson", minutes: 4 })).toStrictEqual([
      ["2026-10-12", 5],
    ]);
  });

  it("keeps nothing on a mock's own day, where the learner moved it", () => {
    const days = listDays(5, { [THURSDAY]: { events: [mock(100)] } });

    const promised = { dueBy: fromIsoDate(THURSDAY), key: "lesson", minutes: 4 };
    expect(listPromisedLessonMinutes({ days, promised })).toStrictEqual(new Map());
  });
});

// "Less Linguagens" moved the phase's challenge to Thursday, the day the learner saw the chapter's
// next lesson on: funding the Sunday mock took that day's time, and the lesson went to Friday.
describe("a promised lesson on a day that funds a mock", () => {
  const days = listDays(7, {
    "2026-10-18": { events: [mock(100)] },
    [THURSDAY]: { events: [boss(15)] },
  });

  const promised = { dueBy: fromIsoDate(THURSDAY), key: "lesson", minutes: 4 };

  it("funds the mock from the other days, keeping the lesson's time after the challenge", () => {
    const funded = fund(days, promised);
    const unkept = fund(days);

    expect(funded.unfunded).toStrictEqual([]);
    expect(getCapacityOn(funded.days, THURSDAY)).toBeGreaterThanOrEqual(4);
    expect(getCapacityOn(unkept.days, THURSDAY)).toBeLessThan(4);
  });

  it("never re-plans what earlier days set aside for the mock", () => {
    const past = [
      { date: "2026-10-10", minutes: 19.375 },
      { date: "2026-10-11", minutes: 19.375 },
    ];

    const funded = fundMocks({
      days,
      funding: [{ contributions: past, date: "2026-10-18", minutes: 100 }],
      moves: [],
      promised: keep(days, promised),
    });

    expect(funded.funding[0]?.contributions.slice(0, 2)).toStrictEqual(past);
  });

  it("refuses a move of the mock the learner asks for that its days can't fund", () => {
    const requestedDays = listDays(4, { "2026-10-14": { events: [mock(200)] } });

    const funded = fundMocks({
      days: requestedDays,
      funding: [],
      moves: [],
      promised: keep(requestedDays, {
        dueBy: fromIsoDate("2026-10-13"),
        key: "lesson",
        minutes: 4,
      }),
    });

    expect(funded.unfunded).toStrictEqual([{ date: "2026-10-14", minutes: 200 }]);
  });
});
