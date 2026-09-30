import "server-only";
import { prisma } from "@zoonk/db";
import { getRequestProgressDateContext } from "../progress/get-request-date-context";
import { getSession } from "../users/get-session";

const SECONDS_PER_MINUTE = 60;

export type DailyTimeLimitStatus = {
  limitMinutes: number | null;
  reached: boolean;
  remainingMinutes: number | null;
  usedMinutes: number;
};

/**
 * How much of today's study time is left under the learner's own limit and the limits guardians
 * set, counted on the learner's local day. Sessions and lessons check it before starting something
 * new; the strictest limit applies.
 */
export async function getDailyTimeLimitStatus(): Promise<DailyTimeLimitStatus | null> {
  const session = await getSession();

  if (!session) {
    return null;
  }

  const userId = session.user.id;

  const [links, profile, { currentDate }] = await Promise.all([
    prisma.guardianLink.findMany({
      select: { dailyLimitMinutes: true },
      where: { dailyLimitMinutes: { not: null }, status: "active", userId },
    }),
    prisma.userLearningProfile.findUnique({
      select: { dailyLimitMinutes: true },
      where: { userId },
    }),
    getRequestProgressDateContext(),
  ]);

  const progress = await prisma.dailyProgress.findUnique({
    select: { timeSpentSeconds: true },
    where: { userDate: { date: currentDate, userId } },
  });

  const usedMinutes = Math.floor((progress?.timeSpentSeconds ?? 0) / SECONDS_PER_MINUTE);

  const limits = [...links, profile].flatMap((owner) => owner?.dailyLimitMinutes ?? []);

  if (limits.length === 0) {
    return { limitMinutes: null, reached: false, remainingMinutes: null, usedMinutes };
  }

  const limitMinutes = Math.min(...limits);
  const remainingMinutes = Math.max(0, limitMinutes - usedMinutes);

  return { limitMinutes, reached: remainingMinutes === 0, remainingMinutes, usedMinutes };
}
