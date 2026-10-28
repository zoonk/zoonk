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

function getHorizonDays({ input, start }: { input: BuildPlanInput; start: Date }): number {
  const { targetDate } = input.goal;
  return targetDate ? Math.min(MAX_PLAN_DAYS, daysBetween(start, targetDate)) : MAX_PLAN_DAYS;
}

export function describeRunDays({
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

export function getOpenStart(input: BuildPlanInput): Date {
  const today = input.today.getTime();

  const studiedToday =
    input.mode === "automatic" &&
    input.items.some((item) => item.status === "done" && item.scheduledFor?.getTime() === today);

  return studiedToday ? addDays(input.today, 1) : input.today;
}
