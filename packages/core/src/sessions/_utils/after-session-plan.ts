import "server-only";
import { after } from "next/server";
import { settleFocusTestAfterSession } from "../../learner/placement/_utils/settle-focus-test";
import { rebalancePlanAfterSession } from "../../preparation/rebalance-plan";

/**
 * What a session's first end may propose for the plan, one after the other, so two proposals
 * about its focus never race: the Focus test's from the session's answers, then the rebalance.
 */
export function proposeAfterSession(session: {
  goalId: string | null;
  sessionId: string;
  userId: string;
}): void {
  after(async () => {
    await settleFocusTestAfterSession(session);
    await rebalancePlanAfterSession(session);
  });
}
