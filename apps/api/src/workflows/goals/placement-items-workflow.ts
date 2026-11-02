import { createHook, getWorkflowMetadata, sleep } from "workflow";
import { start } from "workflow/api";
import { type ContentAnalytics } from "../_shared/content-analytics";
import { trackGenerationFailedStep } from "../_shared/generation-failed-step";
import { repeatUntil } from "../_shared/repeat-until";
import { preparePlacementItems } from "./placement-items";
import { shortPlanPracticeWorkflow } from "./short-plan-practice-workflow";
import { readPlacementExamWaitStep } from "./steps/exam-format-step";
import { recordPlacementPreparedStep } from "./steps/goal-build-outcome-steps";
import { readShortPlanPracticeStep } from "./steps/short-plan-practice-step";

export type PlacementItemsInput = {
  analytics?: ContentAnalytics;
  goalId: string;
  skillIds?: string[];
  waitsForNotice?: boolean;
};

const FORMAT_POLLS = 40;
const FORMAT_POLL = "3s";

const BLUEPRINT_POLLS = 100;

export type PlacementItemsResult = {
  failed: number;
  status: "joined" | "written";
  written: number;
};

/**
 * A run of its own: the workflow runtime moves a run on only once the steps it runs together are
 * done, so questions written beside the plan would hold back the outlines and first lessons.
 */
export async function placementItemsWorkflow(
  input: PlacementItemsInput,
): Promise<PlacementItemsResult> {
  "use workflow";

  const { analytics, goalId, skillIds, waitsForNotice = false } = input;
  const { workflowRunId } = getWorkflowMetadata();
  const hook = createHook({ token: `placement-items:${goalId}` });

  if (await hook.getConflict()) {
    return { failed: 0, status: "joined", written: 0 };
  }

  // Questions in another format than the exam's would mislead placement, and a language
  // certificate's blueprint says which skills only recordings practice.
  if (waitsForNotice) {
    const wait = await repeatUntil({
      done: (pending) => pending !== "formats",
      run: () => readPlacementExamWaitStep(goalId),
      times: FORMAT_POLLS,
      wait: () => sleep(FORMAT_POLL),
    });

    if (wait === "blueprint") {
      await repeatUntil({
        done: (pending) => pending === null,
        run: () => readPlacementExamWaitStep(goalId),
        times: BLUEPRINT_POLLS,
        wait: () => sleep(FORMAT_POLL),
      });
    }
  }

  const { failed, written } = await preparePlacementItems({
    analytics,
    forPlacement: true,
    goalId,
    skillIds,
    workflowRunId,
  });

  const [practice] = await Promise.all([
    readShortPlanPracticeStep(goalId),
    recordPlacementPreparedStep({ failed, goalId, written }),
    failed > 0
      ? trackGenerationFailedStep({
          analytics,
          contentKind: "curriculum",
          task: "placement-questions",
        })
      : null,
  ]);

  if (practice) {
    await start(shortPlanPracticeWorkflow, [{ analytics, goalId, need: practice }]);
  }

  return { failed, status: "written", written };
}
