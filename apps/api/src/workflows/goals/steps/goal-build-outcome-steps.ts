import {
  findGoalResearch,
  finishGoalRebuild,
  isGoalRebuildOwed,
} from "@zoonk/core/goals/rebuild-follow-up";
import { recordGoalBuildFailure } from "@zoonk/core/goals/record-generation";
import { requestGoalPlacement } from "@zoonk/core/learner/placement/request";
import { readGoalGraphState } from "@zoonk/core/library/curriculum/begin-goal-curriculum";
import {
  readPlacementPlanRunId,
  recordPlacementPrepared,
} from "@zoonk/core/lookahead/placement-item-skills";
import { prisma } from "@zoonk/db";
import { logError } from "@zoonk/utils/logger";
import { isRunActive } from "../../_shared/run-activity";

export async function isGoalRebuildOwedStep(input: Parameters<typeof isGoalRebuildOwed>[0]) {
  "use step";

  return isGoalRebuildOwed(input);
}

export async function finishGoalRebuildStep(
  input: Parameters<typeof finishGoalRebuild>[0],
): Promise<void> {
  "use step";

  await finishGoalRebuild(input);
}

export async function isGoalResearchPendingStep(goalId: string): Promise<boolean> {
  "use step";

  const { owed, runId } = await findGoalResearch(goalId);
  return owed || (runId !== null && (await isRunActive(runId)));
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
  placementPart,
  planRunId,
  written,
}: {
  failed: number;
  goalId: string;
  placementPart?: { attemptId: string; part: number };
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

  await recordPlacementPrepared({ goalId, placementPart, planRunId });
}

export async function isPlanPreparedStep(goalId: string): Promise<boolean> {
  "use step";

  const plan = await prisma.plan.findUnique({
    select: { placementPreparedAt: true },
    where: { goalId },
  });

  return Boolean(plan?.placementPreparedAt);
}
