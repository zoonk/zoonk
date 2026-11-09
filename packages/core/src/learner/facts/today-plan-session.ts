import "server-only";
import { prisma } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { cacheTag } from "next/cache";
import { getUserProgressCacheTag } from "../../cache/tags";
import { getAnswerTimeZone } from "../_utils/owned-goal";
import { readOwnedGoal } from "./owned-goal";
import { getRequestInstant } from "./request-instant";

/** GET-only fact after ownership authorization: today's session once Start built the day, else null. */
export async function readTodayPlanSession(userId: string, goalId: string) {
  "use cache: private";

  cacheTag(getUserProgressCacheTag(userId));

  const [goal, instant] = await Promise.all([readOwnedGoal(userId, goalId), getRequestInstant()]);
  const localDate = getDateInTimeZone({ date: instant, timeZone: getAnswerTimeZone({ goal }) });

  return prisma.studySession.findUnique({
    select: {
      blocks: {
        orderBy: { position: "asc" },
        select: { kind: true, lessonId: true, payload: true, status: true },
      },
    },
    where: { userGoalDate: { goalId, localDate, userId } },
  });
}
