import { MS_PER_DAY } from "@zoonk/utils/date";
import { getStartOfWeek } from "../plans/planner/plan-calendar";

const DAYS_PER_WEEK = 7;
const SECONDS_PER_MINUTE = 60;
const MS_PER_MINUTE = 60_000;

const MAX_BLOCK_TIME_FACTOR = 2;

export type WeekDayKind = "afterEnd" | "beforeStart" | "deadline" | "exam" | "rest" | "study";

export type PlanDay = { goalMinutes: number; kind: WeekDayKind };

export type WeekDay = PlanDay & {
  date: Date;
  /** Reached the day's time goal, or finished the day's session in less time. */
  hitGoal: boolean;
  isToday: boolean;
  minutes: number;
  /** Any study counts: partial days are days studied too. */
  studied: boolean;
};

/** Any study counts as a day studied, so time under a minute shows as one rather than 0. */
export function toStudiedMinutes(seconds: number): number {
  return seconds > 0 ? Math.max(1, Math.floor(seconds / SECONDS_PER_MINUTE)) : 0;
}

export function getWeekDayKind({
  date,
  goal,
  goalMinutes,
}: {
  date: Date;
  goal: { isExam: boolean; startDate: Date; targetDate: Date | null };
  goalMinutes: number;
}): WeekDayKind {
  if (goalMinutes > 0) {
    return "study";
  }

  if (goal.targetDate?.getTime() === date.getTime()) {
    return goal.isExam ? "exam" : "deadline";
  }

  if (date < goal.startDate) {
    return "beforeStart";
  }

  return goal.targetDate !== null && date > goal.targetDate ? "afterEnd" : "rest";
}

function includesDate(dates: readonly Date[], date: Date): boolean {
  return dates.some((item) => item.getTime() === date.getTime());
}

/** Monday through Sunday; finishing the day's session satisfies the daily goal even early, while rest days have no goal to hit. */
export function getWeekDays({
  days,
  finishedDates = [],
  getPlanDay,
  today,
}: {
  days: readonly { date: Date; seconds: number }[];
  /** Days whose study session finished, as UTC-midnight labels. */
  finishedDates?: readonly Date[];
  getPlanDay: (date: Date) => PlanDay;
  today: Date;
}): WeekDay[] {
  const start = getStartOfWeek(today).getTime();

  return Array.from({ length: DAYS_PER_WEEK }, (_, index) => {
    const date = new Date(start + index * MS_PER_DAY);
    const seconds = days.find((day) => day.date.getTime() === date.getTime())?.seconds ?? 0;
    const minutes = toStudiedMinutes(seconds);
    const { goalMinutes, kind } = getPlanDay(date);

    return {
      date,
      goalMinutes,
      hitGoal:
        goalMinutes > 0 &&
        (includesDate(finishedDates, date) || seconds >= goalMinutes * SECONDS_PER_MINUTE),
      isToday: date.getTime() === today.getTime(),
      kind,
      minutes,
      studied: includesDate(finishedDates, date) || seconds > 0,
    };
  });
}

/** Returns the next study date within a week, or null; use generic next-session copy when no date is available. */
export function getNextStudyDate({
  getMinutes,
  today,
}: {
  getMinutes: (date: Date) => number;
  today: Date;
}): Date | null {
  const days = Array.from(
    { length: DAYS_PER_WEEK },
    (_, index) => new Date(today.getTime() + (index + 1) * MS_PER_DAY),
  );

  return days.find((date) => getMinutes(date) > 0) ?? null;
}

/** Caps elapsed time at twice the estimate; completed blocks missing a start use the estimate. */
export function getBlockMinutes({
  completedAt,
  estimatedMinutes,
  startedAt,
}: {
  completedAt: Date | null;
  estimatedMinutes: number;
  startedAt: Date | null;
}): number {
  if (!completedAt) {
    return 0;
  }

  if (!startedAt) {
    return estimatedMinutes;
  }

  const minutes = (completedAt.getTime() - startedAt.getTime()) / MS_PER_MINUTE;
  return Math.min(Math.max(0, minutes), estimatedMinutes * MAX_BLOCK_TIME_FACTOR);
}
