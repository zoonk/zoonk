import { getWorkflowMetadata, sleep } from "workflow";
import { type ContentAnalytics } from "../_shared/content-analytics";
import { trackGenerationFailedStep } from "../_shared/generation-failed-step";
import { repeatUntil } from "../_shared/repeat-until";
import { startOnce, waitForRunToken } from "../_shared/run-token";
import { preparePlacementItems } from "./placement-items";
import {
  getShortPlanPracticeToken,
  shortPlanPracticeWorkflow,
} from "./short-plan-practice-workflow";
import { readPlacementExamWaitStep } from "./steps/exam-format-step";
import {
  readPlacementPlanRunIdStep,
  recordPlacementPreparedStep,
} from "./steps/goal-build-outcome-steps";
import { readShortPlanPracticeStep } from "./steps/short-plan-practice-step";

export type PlacementItemsInput = {
  analytics?: ContentAnalytics;
  goalId: string;
  placementPart?: { attemptId: string; part: number };
  skillIds?: string[];
  waitsForNotice?: boolean;
};

const BLUEPRINT_POLLS = 100;
const BLUEPRINT_POLL = "3s";

export type PlacementItemsResult = { failed: number; status: "written"; written: number };

/**
 * A run of its own: the workflow runtime moves a run on only once the steps it runs together are
 * done, so questions written beside the plan would hold back the outlines and first lessons.
 */
export async function placementItemsWorkflow(
  input: PlacementItemsInput,
): Promise<PlacementItemsResult> {
  "use workflow";

  const { analytics, goalId, placementPart, skillIds, waitsForNotice = false } = input;
  const { workflowRunId } = getWorkflowMetadata();

  if (!(await waitForRunToken(`placement-items:${goalId}`))) {
    throw new Error(`Placement items are still being written for ${goalId}`);
  }

  // A language certificate's blueprint says which skills only recordings practice.
  if (waitsForNotice) {
    await repeatUntil({
      done: (pending) => pending === null,
      run: () => readPlacementExamWaitStep(goalId),
      times: BLUEPRINT_POLLS,
      wait: () => sleep(BLUEPRINT_POLL),
    });
  }

  const planRunId = await readPlacementPlanRunIdStep(goalId);

  const { failed, written } = await preparePlacementItems({
    analytics,
    forPlacement: true,
    goalId,
    skillIds,
    workflowRunId,
  });

  const [practice] = await Promise.all([
    placementPart ? null : readShortPlanPracticeStep(goalId),
    recordPlacementPreparedStep({ failed, goalId, placementPart, planRunId, written }),
    failed > 0
      ? trackGenerationFailedStep({
          analytics,
          contentKind: "curriculum",
          task: "placement-questions",
        })
      : null,
  ]);

  if (practice) {
    await startOnce(
      shortPlanPracticeWorkflow,
      [{ analytics, goalId, need: practice }],
      getShortPlanPracticeToken(goalId),
    );
  }

  return { failed, status: "written", written };
}
