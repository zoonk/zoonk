import "server-only";
import { prisma } from "@zoonk/db";
import { settleFocusTestAfterSession } from "../learner/placement/_utils/settle-focus-test";
import { rebalancePlanAfterSession } from "../preparation/rebalance-plan";

/**
 * Internal workflow bridge for the plan work owed by a session's first end. Settle the test
 * before rebalancing so their focus proposals cannot race.
 */
export async function settleSessionPlan(session: {
  goalId: string;
  sessionId: string;
  timeZone: string;
  userId: string;
}): Promise<void> {
  const goal = await prisma.goal.findFirst({
    where: { id: session.goalId, userId: session.userId },
  });

  if (goal?.status !== "active") {
    return;
  }

  await settleFocusTestAfterSession(session);
  await rebalancePlanAfterSession(session);
}
