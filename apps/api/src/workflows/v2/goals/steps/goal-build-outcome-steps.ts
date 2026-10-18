import { recordGoalBuildFailure } from "@zoonk/core/goals/record-generation";
import { recordPlacementPrepared } from "@zoonk/core/lookahead/placement-item-skills";
import { prisma } from "@zoonk/db";
import { logError } from "@zoonk/utils/logger";

/** The run gave up on the plan: placement and the plan stop waiting and offer to start it again. */
export async function recordGoalBuildFailureStep(goalId: string): Promise<void> {
  "use step";

  await recordGoalBuildFailure(goalId);
}

/**
 * Placement's questions are written: the ones that failed after their retry won't come, so
 * placement stops waiting for them (and goes on without placement when none were written).
 */
export async function recordPlacementPreparedStep({
  failed,
  goalId,
  written,
}: {
  failed: number;
  goalId: string;
  written: number;
}): Promise<void> {
  "use step";

  if (failed > 0) {
    logError("[goalContentWorkflow] Placement questions couldn't be written:", {
      failed,
      goalId,
      written,
    });
  }

  await recordPlacementPrepared(goalId);
}

/** Whether a run already wrote placement's questions and first lessons ahead for this plan. */
export async function isPlanPreparedStep(goalId: string): Promise<boolean> {
  "use step";

  const plan = await prisma.plan.findUnique({
    select: { placementPreparedAt: true },
    where: { goalId },
  });

  return Boolean(plan?.placementPreparedAt);
}
