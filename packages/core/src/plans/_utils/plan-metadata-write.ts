import "server-only";
import { type TransactionClient, prisma } from "@zoonk/db";
import { markLearnerChanged } from "../../learner/_utils/mark-learner-changed";
import { PlanConflictError } from "../plan-conflict";
import { type PlanContext } from "./plan-context";

export async function writePlanMetadata<T>({
  context,
  write,
}: {
  context: PlanContext;
  write: (tx: TransactionClient) => Promise<T>;
}): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await markLearnerChanged(tx, { lockPlanIds: [context.plan.id], userId: context.goal.userId });

    const current = await tx.plan.count({
      where: {
        id: context.plan.id,
        inputVersion: context.plan.inputVersion,
        version: context.plan.version,
      },
    });

    if (current !== 1) {
      throw new PlanConflictError();
    }

    return write(tx);
  });
}
