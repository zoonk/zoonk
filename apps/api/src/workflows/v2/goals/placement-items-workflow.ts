import { createHook, getWorkflowMetadata, sleep } from "workflow";
import { start } from "workflow/api";
import { type ContentAnalytics } from "../_shared/content-analytics";
import { trackGenerationFailedStep } from "../_shared/generation-failed-step";
import { repeatUntil } from "../_shared/repeat-until";
import { shortPlanPracticeWorkflow } from "./short-plan-practice-workflow";
import { hasGoalExamFormatStep } from "./steps/exam-format-step";
import { recordPlacementPreparedStep } from "./steps/goal-build-outcome-steps";
import { preparePlacementItemsStep } from "./steps/goal-lookahead-steps";
import { readShortPlanPracticeStep } from "./steps/short-plan-practice-step";

export type PlacementItemsInput = {
  analytics?: ContentAnalytics;
  goalId: string;
  /** The skills the goal's run picked from its skill graph; the plan's own picks when absent. */
  skillIds?: string[];
  /**
   * Research is reading the exam's new notice: the questions wait until the goal knows how its
   * exam asks them (see `hasGoalExamFormat`).
   */
  waitsForNotice?: boolean;
};

/**
 * How long placement's questions wait for a new notice's formats, in polls: a first pass over the
 * notice reads them about a minute after the goal starts, usually before the skills are saved, so
 * this rarely waits; past two minutes, questions are written without them.
 */
const FORMAT_POLLS = 40;
const FORMAT_POLL = "3s";

export type PlacementItemsResult = {
  failed: number;
  status: "joined" | "written";
  written: number;
};

/**
 * Writes placement's questions for the picked skills (see `preparePlacementItemsStep`), then
 * records that they're written, counting the ones that couldn't be: placement stops waiting for
 * those, and goes on without placement when none could be written. A run of its own, so the goal's
 * run never waits on it: the workflow runtime moves a run on only once the steps it runs together
 * are done, and questions written beside the plan held the outlines and the first lessons back
 * for a minute. Placement asks each question as soon as it's stored. One run per goal: a second
 * start joins it. While research reads a new exam's notice, the questions first wait for its
 * formats (`waitsForNotice`). A test days away then gets its practice written
 * (`shortPlanPracticeWorkflow`).
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

  // Questions in another format than the exam's would mislead placement (A–D for a Certo ou
  // Errado exam), so they wait for its formats while research reads a new notice.
  if (waitsForNotice) {
    await repeatUntil({
      done: (known) => known,
      run: () => hasGoalExamFormatStep(goalId),
      times: FORMAT_POLLS,
      wait: () => sleep(FORMAT_POLL),
    });
  }

  const { failed, written } = await preparePlacementItemsStep({
    analytics,
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
