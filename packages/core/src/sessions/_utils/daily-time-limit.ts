import "server-only";
import { prisma } from "@zoonk/db";
import { readDayProgress } from "../../learner/facts/day-progress";
import { readLearningProfile } from "../../learner/facts/learning-profile";
import { toIsoDate } from "../../plans/planner/plan-calendar";
import { type DailyTimeLimitStatus } from "../get-daily-time-limit";

const SECONDS_PER_MINUTE = 60;

/** How much of a day's study time is left under a daily limit (none without a limit). */
function toDailyTimeLimitStatus({
  limitMinutes,
  timeSpentSeconds,
}: {
  limitMinutes: number | null;
  timeSpentSeconds: number;
}): DailyTimeLimitStatus {
  const usedMinutes = Math.floor(timeSpentSeconds / SECONDS_PER_MINUTE);

  if (limitMinutes === null) {
    return { limitMinutes: null, reached: false, remainingMinutes: null, usedMinutes };
  }

  const remainingMinutes = Math.max(0, limitMinutes - usedMinutes);

  return { limitMinutes, reached: remainingMinutes === 0, remainingMinutes, usedMinutes };
}

/**
 * How much of one learner-local day's study time is left under the learner's daily limit.
 *
 * Internal: public capabilities derive `userId` from the signed-in learner.
 */
export async function loadDailyTimeLimitStatus({
  date,
  userId,
}: {
  /** The learner-local date, as a UTC-midnight label. */
  date: Date;
  userId: string;
}): Promise<DailyTimeLimitStatus> {
  const [profile, progress] = await Promise.all([
    prisma.userLearningProfile.findUnique({
      select: { dailyLimitMinutes: true },
      where: { userId },
    }),
    prisma.dailyProgress.findUnique({
      select: { timeSpentSeconds: true },
      where: { userDate: { date, userId } },
    }),
  ]);

  return toDailyTimeLimitStatus({
    limitMinutes: profile?.dailyLimitMinutes ?? null,
    timeSpentSeconds: progress?.timeSpentSeconds ?? 0,
  });
}

/**
 * Whether a page's learner has used up that day's study time. The limit comes from the request's
 * learning-profile fact, and the day's progress is read only under a limit. Starting something
 * new reads both afresh (`loadDailyTimeLimitStatus`).
 *
 * Internal GET fact: public capabilities derive `userId` from the signed-in learner.
 */
export async function readDailyTimeLimitReached({
  date,
  userId,
}: {
  /** The learner-local date, as a UTC-midnight label. */
  date: Date;
  userId: string;
}): Promise<boolean> {
  const profile = await readLearningProfile(userId);
  const limitMinutes = profile?.dailyLimitMinutes ?? null;

  if (limitMinutes === null) {
    return false;
  }

  const progress = await readDayProgress(userId, toIsoDate(date));

  return toDailyTimeLimitStatus({ limitMinutes, timeSpentSeconds: progress?.timeSpentSeconds ?? 0 })
    .reached;
}

/**
 * The day's time under the learner's limit as a page shows it, from the request's profile and day
 * facts. Starting something new reads both afresh (`loadDailyTimeLimitStatus`).
 *
 * Internal GET fact: public capabilities derive `userId` from the signed-in learner.
 */
export async function readDailyTimeLimitStatus({
  date,
  userId,
}: {
  /** The learner-local date, as a UTC-midnight label. */
  date: Date;
  userId: string;
}): Promise<DailyTimeLimitStatus> {
  const [profile, progress] = await Promise.all([
    readLearningProfile(userId),
    readDayProgress(userId, toIsoDate(date)),
  ]);

  return toDailyTimeLimitStatus({
    limitMinutes: profile?.dailyLimitMinutes ?? null,
    timeSpentSeconds: progress?.timeSpentSeconds ?? 0,
  });
}
