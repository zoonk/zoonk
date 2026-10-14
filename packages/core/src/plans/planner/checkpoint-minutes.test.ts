import { describe, expect, it } from "vitest";
import {
  CHECKPOINT_MINUTES_PER_QUESTION,
  CHECKPOINT_QUESTIONS,
} from "../../checkpoints/checkpoint-rules";
import { getPlannedBossMinutes } from "./boss-minutes";
import { fundMocks } from "./mock-funding";
import {
  type StudyCalendar,
  addDays,
  fromIsoDate,
  getStudyMinutes,
  toIsoDate,
} from "./plan-calendar";
import { getExamDayRules, getPlannedMinutes } from "./plan-days";
import { parsePlanSettings } from "./plan-state";
import { addPhaseCheckpoints } from "./plan-units";
import {
  type DayShape,
  type PlanDay,
  type ScheduledUnit,
  placeUnits,
  scheduleUnits,
} from "./schedule-units";
import { markKeptLessons } from "./whole-boss";

/** What a checkpoint takes when it's played: its questions, at an exam question's pace. */
const PLAYED_CHECKPOINT = CHECKPOINT_QUESTIONS * CHECKPOINT_MINUTES_PER_QUESTION;

/** A weekly mock's clock on a regular week. */
const MOCK = 165;

/** A Monday, and the Friday that week holds both a phase's checkpoint and the weekly mock. */
const MONDAY = fromIsoDate("2020-10-12");
const FRIDAY = "2020-10-16";

/** The time the planner keeps for a phase's checkpoint. */
function getPlannedCheckpoint(): number {
  const units = addPhaseCheckpoints({
    getMinutes: (phase) => getPlannedBossMinutes({ goalKind: "exam", phase }),
    phaseNames: ["Phase"],
    units: [
      {
        area: "Area",
        chapterId: null,
        key: "lesson:1",
        kind: "lesson",
        lessonId: "1",
        minutes: 4,
        phase: 0,
        skillId: null,
        title: "",
      },
    ],
  });

  return units.find((unit) => unit.kind === "boss")?.minutes ?? 0;
}

function weekdays(minutes: number): StudyCalendar {
  return {
    dailyMinutes: minutes,
    firstDay: null,
    lightWeeks: [],
    weekdayMinutes: [0, minutes, minutes, minutes, minutes, minutes, 0],
  };
}

/**
 * The days from Monday (`length`, a week's five by default), Friday with its mock and the phase's
 * checkpoint as the planner keeps it, and a mock of its own on each of `mocks`.
 */
function listWeek(
  calendar: StudyCalendar,
  { length = 5, mocks = [] }: { length?: number; mocks?: readonly string[] } = {},
): PlanDay[] {
  return Array.from({ length }, (_, offset) => {
    const date = addDays(MONDAY, offset);
    const day = toIsoDate(date);
    const friday = day === FRIDAY;

    const own = mocks.includes(day)
      ? [{ key: `mock:${day}`, kind: "mock" as const, minutes: MOCK, replacesDay: true, title: "" }]
      : [];

    const shape: DayShape = {
      events: friday
        ? [
            {
              key: "boss:0",
              kind: "boss",
              minutes: getPlannedCheckpoint(),
              replacesDay: false,
              title: "",
            },
            { key: `mock:${FRIDAY}`, kind: "mock", minutes: MOCK, replacesDay: true, title: "" },
          ]
        : own,
      minutes: getStudyMinutes({ calendar, date }),
      open: true,
      phase: 0,
      share: 0.6,
    };

    return { date, shape };
  });
}

/** Friday's minutes on Today, from the funding the plan saves. */
function getFridayMinutes({
  calendar,
  funding,
}: {
  calendar: StudyCalendar;
  funding: ReturnType<typeof fundMocks>["funding"];
}) {
  return getPlannedMinutes({
    calendar,
    date: fromIsoDate(FRIDAY),
    exam: getExamDayRules({ isExam: true, settings: parsePlanSettings({ mockFunding: funding }) }),
    targetDate: null,
  });
}

// A checkpoint is planned for the time it takes when played, so a day that holds it beside a mock
// asks the learner for both, and a week that can't fund both doesn't plan the mock there.
describe("a phase's checkpoint on a mock's day", () => {
  it("plans a checkpoint for the time it takes when played", () => {
    expect(getPlannedCheckpoint()).toBe(PLAYED_CHECKPOINT);
  });

  it("funds the checkpoint and the mock together, and Today asks for both", () => {
    const calendar = weekdays(60);
    const funded = fundMocks({ days: listWeek(calendar), funding: [], moves: [] });

    expect(funded.funding).toMatchObject([
      { date: FRIDAY, fixedMinutes: PLAYED_CHECKPOINT, minutes: MOCK },
    ]);

    expect(getFridayMinutes({ calendar, funding: funded.funding })).toBeCloseTo(
      MOCK + PLAYED_CHECKPOINT,
    );
  });

  // At 35 minutes a weekday, the week holds 175: the mock and a 10-minute checkpoint, not the
  // checkpoint as played. The mock moves to the next free day whose days before it fund it.
  it("moves a mock its day can't fund beside the checkpoint to the next day that can", () => {
    const funded = fundMocks({
      days: listWeek(weekdays(35), { length: 8 }),
      funding: [],
      moves: [],
    });

    expect(funded.unfunded).toStrictEqual([]);
    expect(funded.relocations).toStrictEqual([{ from: FRIDAY, to: "2020-10-19" }]);
    expect(funded.funding).toMatchObject([{ date: "2020-10-19", minutes: MOCK }]);
    expect(funded.funding[0]).not.toHaveProperty("fixedMinutes");

    expect(funded.days[4]?.shape.events.map((event) => event.key)).toStrictEqual(["boss:0"]);

    expect(funded.days[7]?.shape.events.map((event) => event.key)).toStrictEqual([
      "mock:2020-10-19",
    ]);

    expect(funded.days[7]?.shape.minutes).toBeCloseTo(MOCK);
  });

  it("leaves the mock out when no day before the next mock can fund it", () => {
    const funded = fundMocks({
      days: listWeek(weekdays(35), { length: 8, mocks: ["2020-10-19"] }),
      funding: [],
      moves: [],
    });

    expect(funded.relocations).toStrictEqual([]);
    expect(funded.unfunded).toContainEqual({ date: FRIDAY, minutes: MOCK });
  });

  // A day the learner asks to move the mock to is funded there or refused (`unfundedMove`).
  it("never moves on a mock the learner is moving to that day", () => {
    const funded = fundMocks({
      days: listWeek(weekdays(35), { length: 8 }),
      funding: [],
      moves: [],
      requested: new Set([FRIDAY]),
    });

    expect(funded.relocations).toStrictEqual([]);
    expect(funded.unfunded).toStrictEqual([{ date: FRIDAY, minutes: MOCK }]);
  });

  // A plan saved while checkpoints were planned at 10 minutes: what its past days set aside stays,
  // and the days left fund the checkpoint as played.
  it("keeps what a plan saved with a shorter checkpoint set aside, and funds the rest", () => {
    const calendar = weekdays(60);
    const past = { date: "2020-10-09", minutes: 40 };

    const funded = fundMocks({
      days: listWeek(calendar),
      funding: [{ contributions: [past], date: FRIDAY, fixedMinutes: 10, minutes: MOCK }],
      moves: [],
    });

    expect(funded.funding).toHaveLength(1);

    expect(funded.funding[0]).toMatchObject({
      date: FRIDAY,
      fixedMinutes: PLAYED_CHECKPOINT,
      minutes: MOCK,
    });

    expect(funded.funding[0]?.contributions[0]).toStrictEqual(past);

    expect(getFridayMinutes({ calendar, funding: funded.funding })).toBeCloseTo(
      MOCK + PLAYED_CHECKPOINT,
    );
  });
});

/** A queue unit of `minutes`, a lesson or a phase's checkpoint. */
function queueUnit(key: string, kind: "boss" | "lesson", minutes: number) {
  return {
    area: "Area",
    chapterId: null,
    key,
    kind,
    lessonId: kind === "lesson" ? key : null,
    minutes,
    phase: 0,
    skillId: null,
    title: "",
  };
}

// A phase's checkpoint runs whole on one day, past a short day's time, never over two.
describe(placeUnits, () => {
  // Three days of 10 minutes each: ends 10, 20, 30.
  const cumulative = [10, 20, 30];

  it("keeps a checkpoint longer than a day on the day it starts", () => {
    const placed = placeUnits({
      cumulative,
      units: [queueUnit("boss:0", "boss", PLAYED_CHECKPOINT), queueUnit("lesson:1", "lesson", 10)],
    });

    expect(placed.map((entry) => entry.dayIndex)).toStrictEqual([0, 1]);
  });

  it("starts it on the next day when lessons come first on its day", () => {
    const placed = placeUnits({
      cumulative,
      units: [queueUnit("lesson:1", "lesson", 5), queueUnit("boss:0", "boss", PLAYED_CHECKPOINT)],
    });

    expect(placed.map((entry) => entry.dayIndex)).toStrictEqual([0, 1]);
  });
});

/** `count` days from Monday with `minutes` of lesson time each. */
function lessonDays(count: number, minutes = 10): PlanDay[] {
  return Array.from({ length: count }, (_, offset) => ({
    date: addDays(MONDAY, offset),
    shape: { events: [], minutes, open: true, phase: null, share: 1 },
  }));
}

/** A date's place in days from Monday. */
function dayOf(date: Date): number {
  return Math.round((date.getTime() - MONDAY.getTime()) / 86_400_000);
}

/** Each scheduled unit's key, day (from Monday) and, when later, the day its time ends. */
function readSchedule(units: readonly ScheduledUnit[]) {
  return units.map((unit) => [
    unit.key,
    dayOf(unit.date),
    unit.teachingEnd ? dayOf(unit.teachingEnd) : null,
    unit.beside ?? false,
  ]);
}

// A phase's challenge goes on the first study day after the lessons it tests, so a day passes
// between learning and being tested; it leads that day, and the day's time left goes on.
describe("a phase challenge after its lessons", () => {
  it("leads the next study day, the next lesson after it there", () => {
    const { units } = scheduleUnits({
      days: lessonDays(4),
      units: [
        queueUnit("lesson:1", "lesson", 10),
        queueUnit("boss:0", "boss", 5),
        queueUnit("lesson:2", "lesson", 5),
      ],
    });

    expect(readSchedule(units)).toStrictEqual([
      ["lesson:1", 0, null, false],
      ["boss:0", 1, null, false],
      ["lesson:2", 1, null, false],
    ]);
  });

  it("takes all of a day shorter than it, the next lesson the day after", () => {
    const { units } = scheduleUnits({
      days: lessonDays(4),
      units: [
        queueUnit("lesson:1", "lesson", 10),
        queueUnit("boss:0", "boss", 15),
        queueUnit("lesson:2", "lesson", 5),
      ],
    });

    expect(readSchedule(units).map(([key, day]) => [key, day])).toStrictEqual([
      ["lesson:1", 0],
      ["boss:0", 1],
      ["lesson:2", 2],
    ]);
  });

  it("comes after a long first lesson's time ends, not the day it's due", () => {
    const { units } = scheduleUnits({
      days: lessonDays(5),
      units: [queueUnit("lesson:1", "lesson", 25), queueUnit("boss:0", "boss", 15)],
    });

    expect(readSchedule(units)).toStrictEqual([
      ["lesson:1", 0, 2, false],
      ["boss:0", 3, null, false],
    ]);
  });

  it("sits beside its lessons on their last day when no study day is left, taking none of it", () => {
    const { units } = scheduleUnits({
      days: lessonDays(2),
      units: [
        queueUnit("lesson:1", "lesson", 10),
        queueUnit("lesson:2", "lesson", 10),
        queueUnit("boss:0", "boss", 15),
      ],
    });

    expect(readSchedule(units)).toStrictEqual([
      ["lesson:1", 0, null, false],
      ["lesson:2", 1, null, false],
      ["boss:0", 1, null, true],
    ]);
  });

  it("comes after a lesson the run keeps as it is, on a later day than the ones it lays out", () => {
    const { units } = scheduleUnits({
      days: lessonDays(5),
      units: markKeptLessons({
        input: { today: MONDAY },
        kept: [{ kind: "lesson", phase: 0, scheduledFor: addDays(MONDAY, 2) }],
        units: [queueUnit("boss:0", "boss", 5)],
      }),
    });

    expect(readSchedule(units)).toStrictEqual([["boss:0", 3, null, false]]);
  });
});

/** A lesson the plan saved for `saved` (days from Monday), done, finished on `finished` if known. */
function doneLesson({ finished, saved }: { finished: number | null; saved: number }) {
  return {
    completedAt: finished === null ? null : addDays(MONDAY, finished),
    id: "done",
    kind: "lesson" as const,
    phase: 0,
    scheduledFor: addDays(MONDAY, saved),
    status: "done" as const,
  };
}

/** Where a run on day `today` (from Monday) puts the phase's challenge after `lesson`. */
function placeAfter({
  finishedOn,
  lesson,
  today,
}: {
  finishedOn: ReadonlyMap<string, Date>;
  lesson: ReturnType<typeof doneLesson>;
  today: number;
}) {
  const { units } = scheduleUnits({
    days: lessonDays(7).slice(today),
    units: markKeptLessons({
      input: { finishedOn, today: addDays(MONDAY, today) },
      kept: [lesson],
      units: [queueUnit("boss:0", "boss", 5)],
    }),
  });

  return readSchedule(units).map(([key, day]) => [key, day]);
}

// Pedro finished Friday's lesson on Monday: its challenge came the day after the run's day, and
// each day's run moved it a day later until Friday, with nothing new taught.
describe("a phase challenge after a lesson finished on another day than its own", () => {
  const finishedOn = new Map([["done", MONDAY]]);

  it("comes the study day after the day it was finished, whichever day the run plans from", () => {
    const lesson = doneLesson({ finished: 0, saved: 4 });

    expect(placeAfter({ finishedOn, lesson, today: 0 })).toStrictEqual([["boss:0", 1]]);
    expect(placeAfter({ finishedOn, lesson, today: 1 })).toStrictEqual([["boss:0", 1]]);
  });

  it("comes after the day a late lesson was finished, not the day it was due", () => {
    const lesson = doneLesson({ finished: 2, saved: 0 });
    const late = new Map([["done", addDays(MONDAY, 2)]]);

    expect(placeAfter({ finishedOn: late, lesson, today: 2 })).toStrictEqual([["boss:0", 3]]);
  });

  // Done before lessons saved when: taught by the run's day at the latest.
  it("counts a lesson finished before its time was saved by the run's day at the latest", () => {
    const lesson = doneLesson({ finished: null, saved: 4 });

    expect(placeAfter({ finishedOn: new Map(), lesson, today: 0 })).toStrictEqual([["boss:0", 1]]);
  });
});
