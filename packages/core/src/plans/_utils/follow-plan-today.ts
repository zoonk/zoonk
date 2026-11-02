import "server-only";
import { unchanged, writeLearnerChange } from "../../learner/_utils/write-learner-change";
import { followPlanChangeToday } from "../../sessions/_utils/refresh-day-session";
import { parsePlanChangePayload, toPlanChangePayload } from "./plan-change-payload";
import { type PlanContext } from "./plan-context";

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

  await writeLearnerChange({ userId: context.goal.userId }, async (tx) => {
    const change = await tx.planChange.findUniqueOrThrow({ where: { id: changeId } });
    const payload = parsePlanChangePayload(change.payload);
    const todaySession = refresh === "rebuilt" ? "changed" : "unchanged";

    if (payload.todaySession === todaySession) {
      return unchanged(null);
    }

    await tx.planChange.update({
      data: { payload: toPlanChangePayload({ ...payload, todaySession }) },
      where: { id: changeId },
    });
  });
}
