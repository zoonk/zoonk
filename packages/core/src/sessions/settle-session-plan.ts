import "server-only";
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
  await settleFocusTestAfterSession(session);
  await rebalancePlanAfterSession(session);
}
