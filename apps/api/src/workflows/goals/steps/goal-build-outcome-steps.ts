import { recordGoalBuildFailure } from "@zoonk/core/goals/record-generation";
import { recordPlacementPrepared } from "@zoonk/core/lookahead/placement-item-skills";
import { prisma } from "@zoonk/db";
import { logError } from "@zoonk/utils/logger";

export async function recordGoalBuildFailureStep(goalId: string): Promise<void> {
  "use step";

  await recordGoalBuildFailure(goalId);
}

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

export async function isPlanPreparedStep(goalId: string): Promise<boolean> {
  "use step";

  const plan = await prisma.plan.findUnique({
    select: { placementPreparedAt: true },
    where: { goalId },
  });

  return Boolean(plan?.placementPreparedAt);
}
