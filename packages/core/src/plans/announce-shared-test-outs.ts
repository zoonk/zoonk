import "server-only";
import { prisma } from "@zoonk/db";
import { getAnswerTimeZone } from "../learner/_utils/owned-goal";
import { skipTestedOutBlocks } from "../sessions/_utils/skip-tested-out-blocks";
import { announceTestedOutItems } from "./announce-tested-out-items";
import { afterPlanInputWrite } from "./plan-conflict";

/** Read the saved transition so a retry can announce it after the item write already committed. */
export async function announceSharedTestOuts({
  goalId,
  now,
  testedOutAt,
  userId,
}: {
  goalId: string;
  now: Date;
  testedOutAt: Date;
  userId: string;
}): Promise<void> {
  const testedOut = { completedAt: testedOutAt, status: "testedOut" as const };

  const plans = await prisma.plan.findMany({
    include: { goal: true, items: { select: { id: true }, where: testedOut } },
    where: {
      goal: { id: { not: goalId }, status: { not: "archived" }, userId },
      items: { some: testedOut },
    },
  });

  if (plans.length === 0) {
    return;
  }

  await Promise.all(
    plans.map((plan) =>
      afterPlanInputWrite(() =>
        announceTestedOutItems({
          followToday: false,
          goalId: plan.goalId,
          now,
          planItemIds: plan.items.map((item) => item.id),
          skipBlocks: false,
          timeZone: getAnswerTimeZone({ goal: plan.goal }),
        }),
      ),
    ),
  );

  await skipTestedOutBlocks({
    goalId,
    planItemIds: plans.flatMap((plan) => plan.items.map((item) => item.id)),
    skipActive: false,
  });
}
