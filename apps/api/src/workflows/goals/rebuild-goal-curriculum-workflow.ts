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
  readGoalGraphStateStep,
} from "./steps/goal-build-outcome-steps";
import { recordGoalRunStep } from "./steps/record-goal-run-step";

const GRAPH_POLLS = 100;

export type RebuildGoalCurriculumInput = GoalContentInput & { followUp: GoalRebuildFollowUp };

async function waitForSavedGraph(goalId: string) {
  if (!(await waitForRunToken(getGoalContentToken({ goalId, rebuild: true })))) {
    throw new Error(`The curriculum is still being rebuilt for ${goalId}`);
  }

  const graph = await repeatUntil({
    done: (current) => current.ready,
    run: async () => {
      const state = await readGoalGraphStateStep(goalId);

      if (state !== "building") {
        return { ready: true, state };
      }

      const claim = await claimRunToken(getGoalContentToken({ goalId }));

      return claim.conflict
        ? { ready: false, state }
        : { ready: true, state: await readGoalGraphStateStep(goalId) };
    },
    times: GRAPH_POLLS,
    wait: () => sleep("3s"),
  });

  if (!graph.ready) {
    throw new Error(`The initial curriculum has not saved its graph for ${goalId}`);
  }

  return graph.state;
}

export async function rebuildGoalCurriculumWorkflow(input: RebuildGoalCurriculumInput) {
  "use workflow";

  const { followUp, goalId } = input;
  const { workflowRunId: generationId } = getWorkflowMetadata();
  let failed = true;

  try {
    if (!(await isGoalRebuildOwedStep({ followUp, goalId }))) {
      throw new Error("This curriculum rebuild is no longer owed.");
    }

    await recordGoalRunStep({ generationId, goalId });
    const state = await waitForSavedGraph(goalId);
    const result = await goalContentWorkflow({ ...input, rebuild: state === "saved" });
    failed = false;
    return result;
  } finally {
    await finishGoalRebuildStep({ failed, followUp, generationId, goalId });
  }
}
