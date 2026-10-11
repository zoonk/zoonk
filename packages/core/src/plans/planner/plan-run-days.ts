import { MAX_PLAN_DAYS } from "./after-exam";
import { type BuildPlanInput } from "./build-plan";
import { listTakenMockDays } from "./mock-days";
import {
  type StudyCalendar,
  daysBetween,
  fromIsoDate,
  getWeeklyEventWeekday,
} from "./plan-calendar";
import { createExamDays, createLearnDays } from "./plan-days";
import { getKeptExamWindows } from "./plan-phases";

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
export function getHorizonDays({ input, start }: { input: BuildPlanInput; start: Date }): number {
  const { targetDate } = input.goal;
  return targetDate ? Math.min(MAX_PLAN_DAYS, daysBetween(start, targetDate)) : MAX_PLAN_DAYS;
}
