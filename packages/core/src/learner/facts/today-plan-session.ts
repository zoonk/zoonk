import "server-only";
import { prisma } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { cacheTag } from "next/cache";
import { getUserProgressCacheTag } from "../../cache/tags";
import { getSessionChallenges } from "../../sessions/_utils/day-stretch";
import { getAnswerTimeZone } from "../_utils/owned-goal";
import { readOwnedGoal } from "./owned-goal";
import { getRequestInstant } from "./request-instant";

/** GET-only fact after ownership authorization: today's session once the day exists, else the last session's challenges. */
export async function readTodayPlanSession(userId: string, goalId: string) {
  "use cache: private";

  cacheTag(getUserProgressCacheTag(userId));

  const [goal, instant] = await Promise.all([readOwnedGoal(userId, goalId), getRequestInstant()]);
  const localDate = getDateInTimeZone({ date: instant, timeZone: getAnswerTimeZone({ goal }) });

  const latest = await prisma.studySession.findFirst({
    orderBy: { localDate: "desc" },
    select: {
      blocks: {
        orderBy: { position: "asc" },
        select: {
          id: true,
          kind: true,
          lessonId: true,
          payload: true,
          startedAt: true,
          status: true,
        },
      },
      localDate: true,
    },
    where: { goalId, localDate: { lte: localDate }, userId },
  });

  const isToday = latest?.localDate.getTime() === localDate.getTime();

  return {
    lastSessionChallenges: latest && !isToday ? [...getSessionChallenges(latest.blocks)] : [],
    session: latest && isToday ? { blocks: latest.blocks } : null,
  };
}
