import { prisma } from "@zoonk/db";
import { createGoalPlan } from "../create-goal-plan";
import { claimNoticeLanding, endNoticeWait, getNoticeWaitEnd } from "../notice-wait";
import { type PlanGraph } from "../planner/plan-state";

export async function noticeWaitFixture({
  goalId,
  now = new Date(),
}: {
  goalId: string;
  now?: Date;
}): Promise<void> {
  await prisma.plan.update({ data: { noticeWaitUntil: getNoticeWaitEnd(now) }, where: { goalId } });
}

export async function followNoticeReading({ goalId, graph }: { goalId: string; graph: PlanGraph }) {
  await noticeWaitFixture({ goalId });
  await claimNoticeLanding({ goalId });

  const followed = await createGoalPlan({ followNotice: true, goalId, graph });
  await endNoticeWait(goalId);

  return followed;
}
