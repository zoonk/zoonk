import { describe, expect, it } from "vitest";
import {
  CHECKPOINT_MINUTES_PER_QUESTION,
  CHECKPOINT_QUESTIONS,
} from "../../checkpoints/checkpoint-rules";
import { getPlannedBossMinutes } from "./boss-minutes";
import { addPhaseCheckpoints } from "./phase-checkpoints";
import { addDays, fromIsoDate } from "./plan-calendar";
import { type PlanDay, type ScheduledUnit, placeUnits, scheduleUnits } from "./schedule-units";
import { markKeptLessons } from "./whole-boss";

const PLAYED_CHECKPOINT = CHECKPOINT_QUESTIONS * CHECKPOINT_MINUTES_PER_QUESTION;

const MONDAY = fromIsoDate("2020-10-12");

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

describe("a phase's checkpoint", () => {
  it("plans a checkpoint for the time it takes when played", () => {
    expect(getPlannedCheckpoint()).toBe(PLAYED_CHECKPOINT);
  });
});

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

describe(placeUnits, () => {
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

function lessonDays(count: number, minutes = 10): PlanDay[] {
  return Array.from({ length: count }, (_, offset) => ({
    date: addDays(MONDAY, offset),
    shape: { events: [], minutes, open: true, phase: null, share: 1 },
  }));
}

function dayOf(date: Date): number {
  return Math.round((date.getTime() - MONDAY.getTime()) / 86_400_000);
}

function readSchedule(units: readonly ScheduledUnit[]) {
  return units.map((unit) => [
    unit.key,
    dayOf(unit.date),
    unit.teachingEnd ? dayOf(unit.teachingEnd) : null,
    unit.beside ?? false,
  ]);
}

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

  it("counts a lesson finished before its time was saved by the run's day at the latest", () => {
    const lesson = doneLesson({ finished: null, saved: 4 });

    expect(placeAfter({ finishedOn: new Map(), lesson, today: 0 })).toStrictEqual([["boss:0", 1]]);
  });
});
