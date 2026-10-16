import { MAX_PLAN_DAYS } from "../target-date-range";
import { getPlannedBossMinutes } from "./boss-minutes";
import { type BuildPlanInput } from "./build-plan";
import { getRequestedMoves } from "./committed-mock-funding";
import { getKeptMinutes } from "./kept-minutes";
import { findDayMock } from "./mock-day";
import { listTakenMockDays } from "./mock-days";
import { fundMocks } from "./mock-funding";
import { type MockResolution } from "./mock-identity";
import { withMovedEvents } from "./moved-events";
import {
  fixedPortions,
  getDisplacedLessonPortions,
  listPinnedStudyPortions,
} from "./pinned-study-portions";
import {
  type StudyCalendar,
  addDays,
  daysBetween,
  fromIsoDate,
  getWeeklyEventWeekday,
  toIsoDate,
} from "./plan-calendar";
import { createExamDays, createLearnDays } from "./plan-days";
import { type ExistingPlanItem } from "./plan-items";
import { findExamWindow, getKeptExamWindows } from "./plan-phases";
import { type QueueUnit } from "./plan-units";
import { findPromisedLesson, listPromisedLessonMinutes } from "./promised-minutes";
import { type FixedEvent, type PlanDay, listPlanDays } from "./schedule-units";

/** The plan's first day: the day it was started, or today for a plan not saved yet. */
export function getPlanStart(input: BuildPlanInput): Date {
  return input.settings.startDate ? fromIsoDate(input.settings.startDate) : input.today;
}

/** The learner's study time as the plan's calendar reads it. */
export function getCalendar(input: BuildPlanInput): StudyCalendar {
  return {
    dailyMinutes: input.goal.dailyMinutes,
    firstDay: getPlanStart(input),
    lightWeeks: input.settings.lightWeeks,
    weekdayMinutes: input.settings.weekdayMinutes,
  };
}

/**
 * The plan's days, each with what it holds (see `createExamDays`, `createLearnDays`), and an exam's
 * windows (see `getKeptExamWindows`).
 */
export function createDays({ input, planStart }: { input: BuildPlanInput; planStart: Date }) {
  const calendar = getCalendar(input);
  const eventWeekday = getWeeklyEventWeekday(calendar);
  const { practiceBias } = input.settings;
  const { targetDate } = input.goal;

  if (input.goal.kind === "exam" && targetDate) {
    const windows = getKeptExamWindows({
      planStart,
      shown: input.examWindows ?? [],
      targetDate,
      today: input.today,
    });

    return {
      describeDay: createExamDays({
        bossDays: input.bossDays,
        bossMinutes: (phase) =>
          getPlannedBossMinutes({ bossMinutes: input.bossMinutes, goalKind: "exam", phase }),
        calendar,
        eventWeekday,
        fullMockMinutes: input.fullMockMinutes ?? input.mockMinutes,
        mockMinutes: input.mockMinutes,
        practiceBias,
        rules: {
          from: input.today,
          planStart,
          shortMockMinutes: input.settings.shortMockMinutes,
          takenMocks: listTakenMockDays(input.items),
        },
        targetDate,
        windows,
      }),
      windows,
    };
  }

  // An exam without a date yet has no phases, but its weekly mock all the same.
  return {
    describeDay: createLearnDays({
      calendar,
      courseStart: input.courseStart,
      eventWeekday,
      mockMinutes: input.goal.kind === "exam" ? input.mockMinutes : null,
      practiceBias,
      start: planStart,
      targetDate,
    }),
    windows: [],
  };
}

/** How many days from `start` a run lays the plan out over: until its date, at most `MAX_PLAN_DAYS`. */
function getHorizonDays({ input, start }: { input: BuildPlanInput; start: Date }): number {
  const { targetDate } = input.goal;
  return targetDate ? Math.min(MAX_PLAN_DAYS, daysBetween(start, targetDate)) : MAX_PLAN_DAYS;
}

/** A move-only run starts from the saved events, never a newly selected calendar's events. */
function keepSelectedEvents({
  input,
  planDays,
  units,
  windows,
}: {
  input: BuildPlanInput;
  planDays: readonly PlanDay[];
  units: readonly QueueUnit[];
  windows: ReturnType<typeof createDays>["windows"];
}) {
  const byKey = new Map(units.map((unit) => [unit.key, unit]));

  const moves = getRequestedMoves({
    moves: input.settings.movedEvents,
    requested: input.requestedMoveDates ?? new Set(),
  });

  // Saved weekly rows still require the calendar source that authorizes their requested move.
  const checkpoints = new Set(
    planDays
      .filter((day) => day.shape.events.some((event) => event.kind === "checkpoint"))
      .map((day) => toIsoDate(day.date)),
  );

  const movedDate = (item: ExistingPlanItem) =>
    moves.reduce(
      (date, move) =>
        (item.kind === "mock" || (item.kind === "checkpoint" && checkpoints.has(move.to))) &&
        date === move.from
          ? move.to
          : date,
      item.scheduledFor ? toIsoDate(item.scheduledFor) : "",
    );

  const events = Map.groupBy(
    input.items.filter(
      (item) => item.status === "todo" && item.kind !== "lesson" && item.kind !== "chapter",
    ),
    movedDate,
  );

  const selectedDays = planDays.map((day) => {
    const selected = events.get(toIsoDate(day.date)) ?? [];
    const mock = selected.some((item) => item.kind === "mock");

    return {
      ...day,
      shape: {
        ...day.shape,
        events: selected.flatMap((item): FixedEvent[] => {
          if (
            item.kind === "lesson" ||
            item.kind === "chapter" ||
            (mock && item.kind === "review")
          ) {
            return [];
          }

          const fullLength = findExamWindow({ date: day.date, windows })?.kind === "finalStretch";

          return [
            {
              key:
                item.kind === "boss" ? `boss:${item.phase}` : `${item.kind}:${toIsoDate(day.date)}`,
              kind: item.kind,
              minutes: getKeptMinutes({ input, item, units: byKey, windows }),
              ...(item.kind === "mock" ? { mock: { fullLength } } : {}),
              ownPhase: item.phase,
              replacesDay: item.kind === "mock",
              title: item.titleSnapshot,
            },
          ];
        }),
      },
    };
  });

  const portions = listPinnedStudyPortions({ input, units: byKey });
  const displaced = getDisplacedLessonPortions({ days: selectedDays, input, portions });
  const kept = new Map<string, number>();
  const practice = new Map<string, number>();

  for (const key of portions.keys()) {
    fixedPortions({ displaced, key, portions }).forEach((part) => {
      kept.set(part.date, (kept.get(part.date) ?? 0) + part.minutes);

      practice.set(
        part.date,
        (practice.get(part.date) ?? 0) + Math.max(0, part.minutes - part.lessonMinutes),
      );
    });
  }

  return {
    days: selectedDays.map((day) => ({
      ...day,
      shape: { ...day.shape, kept: kept.get(toIsoDate(day.date)) ?? 0 },
    })),
    practice,
  };
}

/** Each move reads the previous layout: a second move starts where the first put its event. */
function replayMoves({ moves, ...options }: Parameters<typeof withMovedEvents>[0]) {
  // Legacy moves sharing a destination keep their canonical winner and remove every source.
  return [...Map.groupBy(moves, (move) => move.to).values()].reduce(
    (describeDay, group) => withMovedEvents({ ...options, describeDay, moves: group }),
    options.describeDay,
  );
}

/**
 * The days a run lays the plan out over, from today: what each holds (see `createDays`), with the
 * learner's moved events on their new days and the plan's mocks funded by the days before them
 * (see `fundMocks`), after the time those days keep for the teaching a challenge tests and the
 * lesson the learner was promised (see `getKeptMinutes`). Returns the funding the plan saves.
 */
export function listFundedPlanDays({
  days,
  input,
  resolution = null,
  start = input.today,
  units = [],
}: {
  days: Pick<ReturnType<typeof createDays>, "describeDay" | "windows">;
  input: BuildPlanInput;
  /** What earlier passes settled about the run's mocks (see `resolvePlannedMocks`). */
  resolution?: MockResolution | null;
  /** Where the run's new work starts (see `getOpenStart`). */
  start?: Date;
  /** The plan's queue, which holds the lesson the learner was promised (see `findPromisedLesson`). */
  units?: readonly QueueUnit[];
}) {
  const moves = input.settings.movedEvents;

  // A moved mock sits its exam day as its new day's phase has it: all of it in the final stretch.
  const resolveMoved = (event: FixedEvent, date: Date): FixedEvent =>
    event.mock
      ? {
          ...event,
          mock: {
            ...event.mock,
            fullLength: findExamWindow({ date, windows: days.windows })?.kind === "finalStretch",
          },
        }
      : event;

  // Moves compose in the order they were made: the learner's, then a mock an earlier run moved off
  // its checkpoint's day (`mockRelocations`), which stays on its new day, as announced, while that
  // day is still free, then the learner's moves of a mock from where that run put it.
  const relocatedTo = new Set(input.settings.mockRelocations.map((relocation) => relocation.to));
  const earlier = moves.filter((move) => !relocatedTo.has(move.from));

  const learnerMoved = replayMoves({ describeDay: days.describeDay, moves: earlier, resolveMoved });

  const relocated = input.settings.mockRelocations.filter(
    (relocation) =>
      !earlier.some((move) => move.from === relocation.from) &&
      findDayMock(learnerMoved(fromIsoDate(relocation.from))) !== undefined &&
      learnerMoved(fromIsoDate(relocation.to)).events.length === 0,
  );

  const describeDay = replayMoves({
    describeDay: replayMoves({ describeDay: learnerMoved, moves: relocated }),
    moves: moves.filter((move) => relocatedTo.has(move.from)),
    resolveMoved,
  });

  const planDays = listPlanDays({
    describeDay,
    horizonDays: getHorizonDays({ input, start: input.today }),
    start: input.today,
  });

  const selected = input.keepSelection
    ? keepSelectedEvents({ input, planDays, units, windows: days.windows })
    : { days: planDays, practice: undefined };

  const funded = fundMocks({
    clocks: input.mockClocks,
    days: selected.days,
    funding: input.settings.mockFunding,
    keepSelection: input.keepSelection,
    kept: {
      promised: listPromisedLessonMinutes({
        days: planDays.filter((day) => day.date >= start),
        promised: findPromisedLesson({ start, units }),
      }),
      tested: input.testedTeaching ?? [],
    },
    moves,
    practice: selected.practice,
    requested: input.requestedMoveDates,
    resolution,
  });

  return { ...funded, relocations: [...relocated, ...funded.relocations] };
}

/**
 * Where new work starts when the run keeps nothing of this week: today, or tomorrow once an
 * automatic run finds today's work studied. A day the learner finished gets nothing on top, as a
 * session's new pace re-plans from tomorrow (see `refreshGoalPlan`): Pedro's only lesson done on a
 * Sunday, a refresh found the day free and added the week's checkpoint, 30 minutes on his 15.
 */
export function getOpenStart(input: BuildPlanInput): Date {
  const today = input.today.getTime();

  const studiedToday =
    input.mode === "automatic" &&
    input.items.some((item) => item.status === "done" && item.scheduledFor?.getTime() === today);

  return studiedToday ? addDays(input.today, 1) : input.today;
}
