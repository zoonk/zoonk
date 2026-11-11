import { type GoalRebuildFollowUp } from "@zoonk/core/goals/rebuild-follow-up";
import { getWorkflowMetadata, sleep } from "workflow";
import { claimRunToken, waitForRunToken } from "../_shared/run-token";
import {
  type GoalContentInput,
  getGoalContentToken,
  goalContentWorkflow,
} from "./goal-content-workflow";
import {
  finishGoalRebuildStep,
  isGoalRebuildOwedStep,
  readGoalGraphStateStep,
} from "./steps/goal-build-outcome-steps";
import { recordGoalRunStep } from "./steps/record-goal-run-step";

export type RebuildGoalCurriculumInput = GoalContentInput & { followUp: GoalRebuildFollowUp };

/* oxlint-disable no-await-in-loop -- Each poll reads the live holder and its newly saved graph. */
async function waitForSavedGraph(goalId: string) {
  if (!(await waitForRunToken(getGoalContentToken({ goalId, rebuild: true })))) {
    throw new Error(`The curriculum is still being rebuilt for ${goalId}`);
  }

  for (;;) {
    const state = await readGoalGraphStateStep(goalId);

    if (state !== "building") {
      return state;
    }

    const claim = await claimRunToken(getGoalContentToken({ goalId }));

    if (!claim.conflict) {
      return readGoalGraphStateStep(goalId);
    }

    await sleep("3s");
  }
}
/* oxlint-enable no-await-in-loop */

export async function rebuildGoalCurriculumWorkflow(input: RebuildGoalCurriculumInput) {
  "use workflow";

  const { followUp, goalId } = input;
  const { workflowRunId: generationId } = getWorkflowMetadata();
  let failed = true;

  try {
    await recordGoalRunStep({ clearFailure: false, generationId, goalId });
    const state = await waitForSavedGraph(goalId);

    if (!(await isGoalRebuildOwedStep({ followUp, goalId }))) {
      throw new Error("This curriculum rebuild is no longer owed.");
    }

    const result = await goalContentWorkflow({ ...input, rebuild: state === "saved" });
    failed = false;
    return result;
  } finally {
    await finishGoalRebuildStep({ failed, followUp, generationId, goalId });
  }
}
