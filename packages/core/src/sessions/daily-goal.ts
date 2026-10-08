import { MS_PER_DAY } from "@zoonk/utils/date";
import { getStartOfWeek } from "../plans/planner/plan-calendar";

const DAYS_PER_WEEK = 7;
const SECONDS_PER_MINUTE = 60;
const MS_PER_MINUTE = 60_000;

/** A block left open longer than twice its estimate counts as twice its estimate. */
const MAX_BLOCK_TIME_FACTOR = 2;

/**
 * What the learner's plans make of a day: a day to study, a rest day they chose, an exam's day or
 * another goal's date, or a day outside their plans (before they began, or after their date).
 */
export type WeekDayKind = "afterEnd" | "beforeStart" | "deadline" | "exam" | "rest" | "study";

/** What the learner's plans give one day. */
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

/**
 * What a day is without study time: the date of a goal (its exam, else its deadline), a day before
 * any of the learner's goals began or after every one of their dates, else a rest day.
 */
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

/**
 * The week's days, Monday to Sunday, with the minutes studied and whether each hit its time goal
 * ("18 of 45 min" today; the week shows which days reached it). Finishing the day's session counts
 * as reaching it: the session is what the plan asked for, even when it took fewer minutes. Rest
 * days have no goal to hit.
 */
export function getWeekDays({
  completedDates = [],
  days,
  getPlanDay,
  today,
}: {
  /** Days with a finished study session, as UTC-midnight labels. */
  completedDates?: readonly Date[];
  days: readonly { date: Date; seconds: number }[];
  /** What the learner's plans give a date. */
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

/**
 * Minutes a block took: from start to finish, capped at twice its estimate so a tab left open
 * doesn't inflate the day. A finished block that never recorded its start counts its estimate.
 */
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

/**
 * How far along the day's session is, in the minutes the plan gave each block the learner
 * finished: Today says "32 of 118 min" after four 8-minute lessons, however fast they went, so
 * the day reads against the plan's own minutes. The time they actually took is what stats count.
 */
export function getSessionMinutesDone(
  blocks: readonly (Pick<TimedBlock, "estimatedMinutes"> & { status: string })[],
): number {
  return blocks
    .filter((block) => block.status === "completed")
    .reduce((sum, block) => sum + (block.estimatedMinutes ?? 0), 0);
}

/** Minutes a session's finished blocks took, each counted by `getBlockMinutes`. */
export function getSessionBlockMinutes(blocks: readonly TimedBlock[]): number {
  return blocks.reduce(
    (sum, block) =>
      sum +
      getBlockMinutes({
        completedAt: block.completedAt,
        estimatedMinutes: block.estimatedMinutes ?? 0,
        startedAt: block.startedAt,
      }),
    0,
  );
}
