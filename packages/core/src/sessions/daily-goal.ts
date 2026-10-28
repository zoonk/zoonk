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

export function getWeekDayKind({
  date,
  goalMinutes,
  goals,
}: {
  date: Date;
  goalMinutes: number;
  goals: readonly { isExam: boolean; startDate: Date; targetDate: Date | null }[];
}): WeekDayKind {
  if (goalMinutes > 0) {
    return "study";
  }

  const target = goals.find((goal) => goal.targetDate?.getTime() === date.getTime());

  if (target) {
    return target.isExam ? "exam" : "deadline";
  }

  const started = goals.filter((goal) => date >= goal.startDate);

  if (started.length === 0) {
    return "beforeStart";
  }

  return started.every((goal) => goal.targetDate !== null && date > goal.targetDate)
    ? "afterEnd"
    : "rest";
}

/** Monday through Sunday; session completion satisfies the daily goal even early, while rest days have no goal to hit. */
export function getWeekDays({
  completedDates = [],
  days,
  getPlanDay,
  today,
}: {
  /** Days with a finished study session, as UTC-midnight labels. */
  completedDates?: readonly Date[];
  days: readonly { date: Date; seconds: number }[];
  getPlanDay: (date: Date) => PlanDay;
  today: Date;
}): WeekDay[] {
  const start = getStartOfWeek(today).getTime();

  return Array.from({ length: DAYS_PER_WEEK }, (_, index) => {
    const date = new Date(start + index * MS_PER_DAY);
    const seconds = days.find((day) => day.date.getTime() === date.getTime())?.seconds ?? 0;
    const minutes = Math.floor(seconds / SECONDS_PER_MINUTE);
    const { goalMinutes, kind } = getPlanDay(date);
    const finished = completedDates.some((completed) => completed.getTime() === date.getTime());

    return {
      date,
      goalMinutes,
      hitGoal: goalMinutes > 0 && (finished || minutes >= goalMinutes),
      isToday: date.getTime() === today.getTime(),
      kind,
      minutes,
      studied: finished || seconds > 0,
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

type TimedBlock = {
  completedAt: Date | null;
  estimatedMinutes: number | null;
  startedAt: Date | null;
};

/** Uses planned minutes of completed blocks for Today; stats count actual elapsed time instead. */
export function getSessionMinutesDone(
  blocks: readonly (Pick<TimedBlock, "estimatedMinutes"> & { status: string })[],
): number {
  return blocks
    .filter((block) => block.status === "completed")
    .reduce((sum, block) => sum + (block.estimatedMinutes ?? 0), 0);
}
