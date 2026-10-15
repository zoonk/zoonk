import "server-only";
import { prisma } from "@zoonk/db";
import { unchanged, writeLearnerChange } from "../learner/_utils/write-learner-change";

/**
 * Remembers the run writing a goal's curriculum (or its quick explanation), so onboarding and the
 * explanation's wait can follow it live and pick it up again after a reload. Called when the run
 * starts, so the goal's screens have it before they open, and again by the run itself (the same id
 * changes nothing; a run started without the first call is saved there). A run that joins another
 * stays saved: its stream hands followers over. A goal deleted meanwhile is left alone. A failure
 * an earlier run recorded is cleared, since this run builds the plan again.
 */
export async function recordGoalGeneration({
  generationId,
  goalId,
}: {
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

      if (!current || (current.generationRunId === generationId && !plan?.buildFailedAt)) {
        return unchanged(null);
      }

      await tx.goal.updateMany({ data: { generationRunId: generationId }, where: { id: goalId } });

      if (plan) {
        await tx.plan.updateMany({
          data: { buildFailedAt: null },
          where: { buildFailedAt: { not: null }, id: plan.id },
        });
      }
    },
  );
}

/**
 * Records that the goal's run gave up building its plan, so placement and the plan stop waiting
 * and offer to start it again. A plan that already has skills keeps working without it (a rebuild
 * that failed leaves the plan it had).
 */
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
