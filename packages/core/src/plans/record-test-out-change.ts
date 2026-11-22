import "server-only";
import { prisma } from "@zoonk/db";
import { type FollowUp } from "../follow-ups/follow-up-contract";
import { getAnswerTimeZone } from "../learner/_utils/owned-goal";
import { announceTestedOutItems } from "./announce-tested-out-items";
import { PlanConflictError } from "./plan-conflict";

type Input = Extract<FollowUp, { kind: "recordTestOutChange" }>["input"];

/** The same receipt can affect several plans when they teach the same topic. */
export async function recordTestOutChange({
  goalId,
  itemIds,
  receipt,
  timeZone,
  userId,
}: Input & { userId: string }) {
  const plans = await prisma.plan.findMany({
    include: {
      goal: true,
      items: { select: { id: true }, where: { id: { in: itemIds }, status: "testedOut" } },
    },
    where: {
      goal: { status: { not: "archived" }, userId },
      items: { some: { id: { in: itemIds }, status: "testedOut" } },
    },
  });

  await Promise.all(
    plans.map(async (plan) => {
      const change = await announceTestedOutItems({
        goalId: plan.goalId,
        now: new Date(),
        planItemIds: plan.items.map(({ id }) => id),
        testReceipt: receipt,
        timeZone: plan.goalId === goalId ? timeZone : getAnswerTimeZone({ goal: plan.goal }),
      });

      if (!change?.changeId) {
        throw new PlanConflictError();
      }
    }),
  );
}
