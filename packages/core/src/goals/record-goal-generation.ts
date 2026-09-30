import "server-only";
import { prisma } from "@zoonk/db";

/**
 * Remembers the run writing a goal's curriculum (or its quick explanation), so onboarding and the
 * explanation's wait can follow it live and pick it up again after a reload. Called by the run
 * itself, once it knows it isn't joining another one; a goal deleted meanwhile is left alone. A
 * failure an earlier run recorded is cleared, since this run builds the plan again.
 */
export async function recordGoalGeneration({
  generationId,
  goalId,
}: {
  generationId: string;
  goalId: string;
}): Promise<void> {
  await prisma.$transaction([
    prisma.goal.updateMany({ data: { generationRunId: generationId }, where: { id: goalId } }),
    prisma.plan.updateMany({
      data: { buildFailedAt: null },
      where: { buildFailedAt: { not: null }, goalId },
    }),
  ]);
}

/**
 * Records that the goal's run gave up building its plan, so placement and the plan stop waiting
 * and offer to start it again. A plan that already has skills keeps working without it (a rebuild
 * that failed leaves the plan it had).
 */
export async function recordGoalBuildFailure(goalId: string): Promise<void> {
  await prisma.plan.updateMany({ data: { buildFailedAt: new Date() }, where: { goalId } });
}
