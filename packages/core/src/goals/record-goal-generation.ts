import "server-only";
import { prisma } from "@zoonk/db";
import { unchanged, writeLearnerChange } from "../learner/_utils/write-learner-change";

/**
 * Only the workflow that acquired the run token clears an earlier failure: an HTTP receipt can
 * arrive after it failed.
 */
export async function recordGoalGeneration({
  clearFailure = true,
  expectedGenerationId,
  generationId,
  goalId,
}: {
  clearFailure?: boolean;
  /** The value observed before HTTP started the run; a newer workflow record wins. */
  expectedGenerationId?: string | null;
  generationId: string;
  goalId: string;
}): Promise<void> {
  const goal = await prisma.goal.findUnique({
    include: { plan: { select: { id: true } } },
    where: { id: goalId },
  });

  if (!goal) {
    return;
  }

  await writeLearnerChange(
    { lockPlanIds: goal.plan ? [goal.plan.id] : [], userId: goal.userId },
    async (tx) => {
      const current = await tx.goal.findUnique({ where: { id: goalId } });
      const plan = goal.plan ? await tx.plan.findUnique({ where: { id: goal.plan.id } }) : null;

      if (
        !current ||
        (expectedGenerationId !== undefined &&
          current.generationRunId !== expectedGenerationId &&
          current.generationRunId !== generationId) ||
        (current.generationRunId === generationId && (!clearFailure || !plan?.buildFailedAt))
      ) {
        return unchanged(null);
      }

      await tx.goal.updateMany({ data: { generationRunId: generationId }, where: { id: goalId } });

      if (plan && clearFailure) {
        await tx.plan.updateMany({
          data: { buildFailedAt: null },
          where: { buildFailedAt: { not: null }, id: plan.id },
        });
      }
    },
  );
}

export async function recordGoalBuildFailure(goalId: string): Promise<void> {
  const goal = await prisma.goal.findUnique({
    include: { plan: { select: { id: true } } },
    where: { id: goalId },
  });

  if (!goal?.plan) {
    return;
  }

  const planId = goal.plan.id;

  await writeLearnerChange({ lockPlanIds: [planId], userId: goal.userId }, async (tx) => {
    const updated = await tx.plan.updateMany({
      data: { buildFailedAt: new Date() },
      where: { buildFailedAt: null, id: planId },
    });

    if (updated.count === 0) {
      return unchanged(null);
    }
  });
}
