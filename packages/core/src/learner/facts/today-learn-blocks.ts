import "server-only";
import { prisma } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { cacheTag } from "next/cache";
import { getUserProgressCacheTag } from "../../cache/tags";
import { type TodayLearnBlock } from "../../plans/_utils/up-next-item";
import { readBlockPayload } from "../../sessions/block-payload";
import { getAnswerTimeZone } from "../_utils/owned-goal";
import { readOwnedGoal } from "./owned-goal";
import { getRequestInstant } from "./request-instant";

/** GET-only fact after ownership authorization: active lesson first; empty until the day exists. */
export async function readTodayLearnBlocks(
  userId: string,
  goalId: string,
): Promise<TodayLearnBlock[]> {
  "use cache: private";

  cacheTag(getUserProgressCacheTag(userId));

  const [goal, instant] = await Promise.all([readOwnedGoal(userId, goalId), getRequestInstant()]);
  const localDate = getDateInTimeZone({ date: instant, timeZone: getAnswerTimeZone({ goal }) });

  const session = await prisma.studySession.findUnique({
    select: {
      blocks: {
        orderBy: { position: "asc" },
        select: { id: true, lessonId: true, payload: true, status: true },
        where: { kind: "learn", status: { in: ["active", "pending"] } },
      },
    },
    where: { userGoalDate: { goalId, localDate, userId } },
  });

  const blocks = session?.blocks ?? [];

  return [
    ...blocks.filter((block) => block.status === "active"),
    ...blocks.filter((block) => block.status === "pending"),
  ].map((block) => ({ lessonId: block.lessonId, planItemId: readBlockPayload(block).planItemId }));
}
