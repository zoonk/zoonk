import "server-only";
import { getRequestProgressDateContext } from "../progress/get-request-date-context";
import { getSession } from "../users/get-session";
import { loadDailyTimeLimitStatus } from "./_utils/daily-time-limit";

export type DailyTimeLimitStatus = {
  limitMinutes: number | null;
  reached: boolean;
  remainingMinutes: number | null;
  usedMinutes: number;
};

/**
 * How much of today's study time is left under the learner's daily limit, counted on their local
 * day. Sessions and lessons check it before starting something new.
 */
export async function getDailyTimeLimitStatus(): Promise<DailyTimeLimitStatus | null> {
  const session = await getSession();

  if (!session) {
    return null;
  }

  const { currentDate } = await getRequestProgressDateContext();

  return loadDailyTimeLimitStatus({ date: currentDate, userId: session.user.id });
}
