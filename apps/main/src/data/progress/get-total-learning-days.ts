import "server-only";
import { getSession } from "@zoonk/core/users/session/get";
import { prisma } from "@zoonk/db";
import { cache } from "react";
import { getCompletedLessonDayWhere } from "./_utils/completed-lesson-day-where";

type TotalLearningDaysData = { learningDays: number };

const cachedGetTotalLearningDays = cache(
  async (headers?: Headers): Promise<TotalLearningDaysData | null> => {
    const session = await getSession(headers);

    if (!session) {
      return null;
    }

    const userId = session.user.id;

    const learningDays = await prisma.dailyProgress.count({
      where: getCompletedLessonDayWhere({ userId }),
    });

    return { learningDays };
  },
);

/**
 * The homepage needs the lifetime learning-day total. DailyProgress rows are
 * already owned by the signed-in user, so counting completed rows gives the
 * all-time total without deriving an account-created date boundary.
 */
export function getTotalLearningDays(params?: {
  headers?: Headers;
}): Promise<TotalLearningDaysData | null> {
  return cachedGetTotalLearningDays(params?.headers);
}
