import { MS_PER_DAY } from "@zoonk/utils/date";
import { getStartOfWeek } from "../plans/planner/plan-calendar";

const DAYS_PER_WEEK = 7;
const SECONDS_PER_MINUTE = 60;
const MS_PER_MINUTE = 60_000;

/** A block left open longer than twice its estimate counts as twice its estimate. */
const MAX_BLOCK_TIME_FACTOR = 2;

export type WeekDay = {
  date: Date;
  /** The minutes the learner's plans give the day; 0 on a rest day. */
  goalMinutes: number;
  /** Reached the day's time goal. */
  hitGoal: boolean;
  isToday: boolean;
  minutes: number;
  /** Any study counts: partial days are days studied too. */
  studied: boolean;
};

/**
 * The week's days, Monday to Sunday, with the minutes studied and whether each hit its time goal
 * ("18 of 45 min" today; the week shows which days reached it). Rest days have no goal to hit.
 */
export function getWeekDays({
  days,
  getGoalMinutes,
  today,
}: {
  days: readonly { date: Date; seconds: number }[];
  /** The minutes the learner's plans give a date. */
  getGoalMinutes: (date: Date) => number;
  today: Date;
}): WeekDay[] {
  const start = getStartOfWeek(today).getTime();

  return Array.from({ length: DAYS_PER_WEEK }, (_, index) => {
    const date = new Date(start + index * MS_PER_DAY);
    const seconds = days.find((day) => day.date.getTime() === date.getTime())?.seconds ?? 0;
    const minutes = Math.floor(seconds / SECONDS_PER_MINUTE);
    const goalMinutes = getGoalMinutes(date);

    return {
      date,
      goalMinutes,
      hitGoal: goalMinutes > 0 && minutes >= goalMinutes,
      isToday: date.getTime() === today.getTime(),
      minutes,
      studied: seconds > 0,
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
