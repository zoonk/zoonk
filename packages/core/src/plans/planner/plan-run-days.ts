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
import { getItemKey } from "./plan-items";
import { findExamWindow, getKeptExamWindows } from "./plan-phases";
import { type PlanSettings } from "./plan-state";
import { DEFAULT_LESSON_MINUTES, type QueueUnit } from "./plan-units";
import { findPromisedLesson, listPromisedLessonMinutes } from "./promised-minutes";
import { type FixedEvent, type PlanDay, listPlanDays } from "./schedule-units";
import { getTaughtDay } from "./whole-boss";

export type RunDayInput = Pick<
  BuildPlanInput,
  | "bossDays"
  | "bossMinutes"
  | "examWindows"
  | "fullMockMinutes"
  | "goal"
  | "items"
  | "mockMinutes"
  | "settings"
  | "today"
>;

export function getPlanStart(input: Pick<RunDayInput, "settings" | "today">): Date {
  return input.settings.startDate ? fromIsoDate(input.settings.startDate) : input.today;
}

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

  return {
    describeDay: createLearnDays({
      calendar,
      eventWeekday,
      mockMinutes: input.goal.kind === "exam" ? input.mockMinutes : null,
      practiceBias,
      start: planStart,
      targetDate,
    }),
    windows: [],
  };
}

function getHorizonDays({ input, start }: { input: BuildPlanInput; start: Date }): number {
  const { targetDate } = input.goal;
  return targetDate ? Math.min(MAX_PLAN_DAYS, daysBetween(start, targetDate)) : MAX_PLAN_DAYS;
}

function describeRunDays({
  days,
  settings,
}: {
  days: Pick<ReturnType<typeof createDays>, "describeDay" | "windows">;
  settings: Pick<PlanSettings, "movedEvents">;
}) {
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
    describeDay: withMovedEvents({
      describeDay: days.describeDay,
      moves: settings.movedEvents,
      resolveMoved,
    }),
  };
}

/** Lessons finished today already took part of today's time, so the rest of today holds only what's left. */
function reserveFinishedToday({
  days,
  input,
  units,
}: {
  days: PlanDay[];
  input: BuildPlanInput;
  units: readonly QueueUnit[];
}): PlanDay[] {
  const today = input.today.getTime();
  const byKey = new Map(units.map((unit) => [unit.key, unit]));

  const minutes = input.items
    .filter(
      (item) =>
        item.kind === "lesson" &&
        item.status === "done" &&
        getTaughtDay({ input, item })?.getTime() === today,
    )
    .reduce(
      (total, item) =>
        total + (byKey.get(getItemKey(item))?.minutes ?? DEFAULT_LESSON_MINUTES * input.paceFactor),
      0,
    );

  if (minutes === 0) {
    return days;
  }

  return days.map((day) =>
    day.date.getTime() === today
      ? { ...day, shape: { ...day.shape, reserved: (day.shape.reserved ?? 0) + minutes } }
      : day,
  );
}

export function listFundedPlanDays({
  days,
  input,
  resolution = null,
  start = input.today,
  units = [],
}: {
  days: Pick<ReturnType<typeof createDays>, "describeDay" | "windows">;
  input: BuildPlanInput;
  resolution?: MockResolution | null;
  start?: Date;
  units?: readonly QueueUnit[];
}) {
  const { describeDay } = describeRunDays({ days, settings: input.settings });

  const planDays = reserveFinishedToday({
    days: listPlanDays({
      describeDay,
      horizonDays: getHorizonDays({ input, start: input.today }),
      start: input.today,
    }),
    input,
    units,
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

export function getOpenStart(input: BuildPlanInput): Date {
  const today = input.today.getTime();

  const studiedToday =
    input.mode === "automatic" &&
    input.items.some((item) => item.status === "done" && item.scheduledFor?.getTime() === today);

  return studiedToday ? addDays(input.today, 1) : input.today;
}
