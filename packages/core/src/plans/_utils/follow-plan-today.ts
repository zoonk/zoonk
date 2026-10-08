import "server-only";
import { prisma } from "@zoonk/db";
import { followPlanChangeToday } from "../../sessions/_utils/refresh-day-session";
import { parsePlanChangePayload, toPlanChangePayload } from "./plan-change-payload";
import { type PlanContext } from "./plan-context";

/**
 * Brings today's session along with a change the learner made or applied, once it's saved: what
 * they haven't started follows the new plan. An applied change keeps whether today's session took
 * it (`changed`) or stays as it was because it's underway or done (`unchanged`: from the next study
 * day), so the learner is told which. A change that leaves today's blocks as they were says
 * neither (null, as when today has no session yet): the plan follows it from now on.
 */
export async function followPlanToday({
  changeId = null,
  context,
}: {
  changeId?: string | null;
  context: PlanContext;
}): Promise<void> {
  const refresh = await followPlanChangeToday({
    goalId: context.goal.id,
    localDate: context.today,
    timeZone: context.timeZone,
    userId: context.goal.userId,
  });

  if (!changeId || refresh === "notBuilt" || refresh === "same") {
    return;
  }

  const change = await prisma.planChange.findUniqueOrThrow({ where: { id: changeId } });

  await prisma.planChange.update({
    data: {
      payload: toPlanChangePayload({
        ...parsePlanChangePayload(change.payload),
        todaySession: refresh === "rebuilt" ? "changed" : "unchanged",
      }),
    },
    where: { id: changeId },
  });
}
