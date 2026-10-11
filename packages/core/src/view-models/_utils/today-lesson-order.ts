import "server-only";
import { type Goal, prisma } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { getAnswerTimeZone } from "../../learner/_utils/owned-goal";
import { type TodayLearnBlock } from "../../plans/_utils/up-next-item";
import { readBlockPayload } from "../../sessions/block-payload";

/**
 * Today's session's lessons not done yet, in the order Today opens them: the one started first,
 * then those not started. Read without building the session, so a page never builds the day; empty
 * before the day's session exists. Every screen's "Up next" reads it (`findUpNextItem`).
 */
export async function loadTodayLearnBlocks(
  goal: Pick<Goal, "id" | "timezone" | "userId">,
): Promise<TodayLearnBlock[]> {
  const localDate = getDateInTimeZone({ date: new Date(), timeZone: getAnswerTimeZone({ goal }) });

  const session = await prisma.studySession.findUnique({
    select: {
      blocks: {
        orderBy: { position: "asc" },
        select: { id: true, lessonId: true, payload: true, status: true },
        where: { kind: "learn", status: { in: ["active", "pending"] } },
      },
    },
    where: { userGoalDate: { goalId: goal.id, localDate, userId: goal.userId } },
  });

  const blocks = session?.blocks ?? [];

  return [
    ...blocks.filter((block) => block.status === "active"),
    ...blocks.filter((block) => block.status === "pending"),
  ].map((block) => ({ lessonId: block.lessonId, planItemId: readBlockPayload(block).planItemId }));
}
