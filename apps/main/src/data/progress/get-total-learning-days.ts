import "server-only";
import { getUserProgressCacheTag } from "@/data/cache-tags";
import { getSession } from "@/data/users/get-session";
import { prisma } from "@zoonk/db";
import { cacheTag } from "next/cache";
import { getCompletedLessonDayWhere } from "./_utils/completed-lesson-day-where";

type TotalLearningDaysData = { learningDays: number };

/** Returns the lifetime learning-day total for an explicit learner identity. */
export async function getTotalLearningDaysForUser(userId: string): Promise<TotalLearningDaysData> {
  "use cache";

  cacheTag(getUserProgressCacheTag(userId));

  const learningDays = await prisma.dailyProgress.count({
    where: getCompletedLessonDayWhere({ userId }),
  });

  return { learningDays };
}

/** Returns the authenticated learner's lifetime learning-day total. */
export async function getTotalLearningDays(): Promise<TotalLearningDaysData | null> {
  const session = await getSession();
  return session ? getTotalLearningDaysForUser(session.user.id) : null;
}
