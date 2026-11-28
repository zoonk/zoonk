import { type GoalRebuildFollowUp } from "@zoonk/core/goals/rebuild-follow-up";
import { getWorkflowMetadata, sleep } from "workflow";
import { repeatUntil } from "../_shared/repeat-until";
import { claimRunToken, waitForRunToken } from "../_shared/run-token";
import {
  type GoalContentInput,
  getGoalContentToken,
  goalContentWorkflow,
} from "./goal-content-workflow";
import {
  finishGoalRebuildStep,
  isGoalRebuildOwedStep,
  isGoalResearchPendingStep,
  readGoalGraphStateStep,
} from "./steps/goal-build-outcome-steps";
import { recordGoalRunStep } from "./steps/record-goal-run-step";

const RESEARCH_POLL = "10s";
const MAX_RESEARCH_POLLS = 60;

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

/**
 * A changed exam country owes research for the new country's exam alongside this rebuild, so the
 * rebuild waits for it to link that exam's notice. Research that outlasts the wait is left behind,
 * as a first build leaves it.
 */
function waitForGoalResearch(goalId: string): Promise<boolean> {
  return repeatUntil({
    done: (pending) => !pending,
    run: () => isGoalResearchPendingStep(goalId),
    times: MAX_RESEARCH_POLLS,
    wait: () => sleep(RESEARCH_POLL),
  });
}

export async function rebuildGoalCurriculumWorkflow(input: RebuildGoalCurriculumInput) {
  "use workflow";

  const { followUp, goalId } = input;
  const { workflowRunId: generationId } = getWorkflowMetadata();
  let failed = true;

  try {
    await recordGoalRunStep({ clearFailure: false, generationId, goalId });
    const state = await waitForSavedGraph(goalId);
    await waitForGoalResearch(goalId);

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
