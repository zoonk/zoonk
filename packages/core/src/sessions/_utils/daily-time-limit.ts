import "server-only";
import { prisma } from "@zoonk/db";
import { type DailyTimeLimitStatus } from "../get-daily-time-limit";

const SECONDS_PER_MINUTE = 60;

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

  const usedMinutes = Math.floor((progress?.timeSpentSeconds ?? 0) / SECONDS_PER_MINUTE);

  const limitMinutes = profile?.dailyLimitMinutes ?? null;

  if (limitMinutes === null) {
    return { limitMinutes: null, reached: false, remainingMinutes: null, usedMinutes };
  }

  const remainingMinutes = Math.max(0, limitMinutes - usedMinutes);

  return { limitMinutes, reached: remainingMinutes === 0, remainingMinutes, usedMinutes };
}
