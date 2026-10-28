import { MAX_PLAN_DAYS } from "../target-date-range";
import { getPlannedBossMinutes } from "./boss-minutes";
import { type BuildPlanInput } from "./build-plan";
import { listTakenMockDays } from "./mock-days";
import { fundMocks } from "./mock-funding";
import { type MockResolution } from "./mock-identity";
import { withMovedEvents } from "./moved-events";
import {
  type StudyCalendar,
  addDays,
  daysBetween,
  fromIsoDate,
  getWeeklyEventWeekday,
  toIsoDate,
} from "./plan-calendar";
import { createExamDays, createLearnDays } from "./plan-days";
import { findExamWindow, getKeptExamWindows } from "./plan-phases";
import { type PlanSettings } from "./plan-state";
import { type QueueUnit } from "./plan-units";
import { findPromisedLesson, listPromisedLessonMinutes } from "./promised-minutes";
import { type FixedEvent, listPlanDays } from "./schedule-units";

/**
 * What a run's days read of its input (see `createDays`): all a challenge's screen needs to lay
 * out the days of the plan's next run from what it loaded.
 */
export type RunDayInput = Pick<
  BuildPlanInput,
  | "bossDays"
  | "bossMinutes"
  | "courseStart"
  | "examWindows"
  | "fullMockMinutes"
  | "goal"
  | "items"
  | "mockMinutes"
  | "settings"
  | "today"
>;

/** The plan's first day: the day it was started, or today for a plan not saved yet. */
export function getPlanStart(input: Pick<RunDayInput, "settings" | "today">): Date {
  return input.settings.startDate ? fromIsoDate(input.settings.startDate) : input.today;
}

/** The learner's study time as the plan's calendar reads it. */
export function getCalendar(
  input: Pick<RunDayInput, "goal" | "settings" | "today">,
): StudyCalendar {
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
export function createDays({ input, planStart }: { input: RunDayInput; planStart: Date }) {
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

/** Each move reads the previous layout: a second move starts where the first put its event. */
function replayMoves({ moves, ...options }: Parameters<typeof withMovedEvents>[0]) {
  // Moves sharing a destination (one change can make two) keep the winner `findMoveTo` picks and
  // remove every source.
  return [...Map.groupBy(moves, (move) => move.to).values()].reduce(
    (describeDay, group) => withMovedEvents({ ...options, describeDay, moves: group }),
    options.describeDay,
  );
}

/**
 * What each day of a run holds before its mocks are funded (see `createDays`), with the events the
 * learner moved onto their new days, in the order they moved them.
 */
export function describeRunDays({
  days,
  settings,
}: {
  days: Pick<ReturnType<typeof createDays>, "describeDay" | "windows">;
  settings: Pick<PlanSettings, "movedEvents">;
}) {
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

  return {
    describeDay: replayMoves({
      describeDay: days.describeDay,
      moves: settings.movedEvents,
      resolveMoved,
    }),
  };
}

/**
 * The days a run lays the plan out over, from today: what each holds, with the events moved onto
 * their new days (see `describeRunDays`), and the plan's mocks funded by the days before them
 * (see `fundMocks`), after the time those days keep for the lesson the learner was promised (see
 * `keepWindowTeaching`). Returns the funding the plan saves.
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
  const { describeDay } = describeRunDays({ days, settings: input.settings });

  const planDays = listPlanDays({
    describeDay,
    horizonDays: getHorizonDays({ input, start: input.today }),
    start: input.today,
  });

  return fundMocks({
    clocks: input.mockClocks,
    days: planDays,
    from: toIsoDate(start),
    funding: input.settings.mockFunding,
    moves: input.settings.movedEvents,
    promised: listPromisedLessonMinutes({
      days: planDays.filter((day) => day.date >= start),
      promised: findPromisedLesson({ start, units }),
    }),
    resolution,
  });
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
