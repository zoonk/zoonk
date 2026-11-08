import { finishGoalRebuild, isGoalRebuildOwed } from "@zoonk/core/goals/rebuild-follow-up";
import { recordGoalBuildFailure } from "@zoonk/core/goals/record-generation";
import { requestGoalPlacement } from "@zoonk/core/learner/placement/request";
import { readGoalGraphState } from "@zoonk/core/library/curriculum/begin-goal-curriculum";
import {
  readPlacementPlanRunId,
  recordPlacementPrepared,
} from "@zoonk/core/lookahead/placement-item-skills";
import { prisma } from "@zoonk/db";
import { logError } from "@zoonk/utils/logger";

export async function isGoalRebuildOwedStep(
  input: Parameters<typeof isGoalRebuildOwed>[0],
): Promise<boolean> {
  "use step";

  return isGoalRebuildOwed(input);
}

export async function finishGoalRebuildStep(
  input: Parameters<typeof finishGoalRebuild>[0],
): Promise<void> {
  "use step";

  await finishGoalRebuild(input);
}

export async function readGoalGraphStateStep(goalId: string) {
  "use step";

  return readGoalGraphState(goalId);
}

export async function requestGoalPlacementStep(goalId: string): Promise<boolean> {
  "use step";

  return requestGoalPlacement(goalId);
}

export async function recordGoalBuildFailureStep(
  input: Parameters<typeof recordGoalBuildFailure>[0],
): Promise<void> {
  "use step";

  await recordGoalBuildFailure(input);
}

export async function readPlacementPlanRunIdStep(goalId: string): Promise<string | null> {
  "use step";

  return readPlacementPlanRunId(goalId);
}

export async function recordPlacementPreparedStep({
  failed,
  goalId,
  planRunId,
  written,
}: {
  failed: number;
  goalId: string;
  planRunId: string | null;
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

  await recordPlacementPrepared({ goalId, planRunId });
}

export async function isPlanPreparedStep(goalId: string): Promise<boolean> {
  "use step";

  const plan = await prisma.plan.findUnique({
    select: { placementPreparedAt: true },
    where: { goalId },
  });

  return Boolean(plan?.placementPreparedAt);
}
