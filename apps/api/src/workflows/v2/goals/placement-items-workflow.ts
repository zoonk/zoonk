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
  /** The skills the goal's run picked from its skill graph; the plan's own picks when absent. */
  skillIds?: string[];
  /**
   * Research is reading the exam's new notice: the questions wait until the goal knows how its
   * exam asks them, or a language certificate's blueprint (see `getPlacementExamWait`).
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

/**
 * How long a language certificate's questions wait for its blueprint, in polls of `FORMAT_POLL`:
 * it was linked 84 s after IELTS's questions started and 151 s after DELE's (10 Oct 2026); past
 * five minutes, questions are written without it.
 */
const BLUEPRINT_POLLS = 100;

export type PlacementItemsResult = {
  failed: number;
  status: "joined" | "written";
  written: number;
};

/**
 * Writes placement's questions for the picked skills (see `preparePlacementItems`), then
 * records that they're written, counting the ones that couldn't be: placement stops waiting for
 * those, and goes on without placement when none could be written. A run of its own, so the goal's
 * run never waits on it: the workflow runtime moves a run on only once the steps it runs together
 * are done, and questions written beside the plan held the outlines and the first lessons back
 * for a minute. Placement asks each question as soon as it's stored. One run per goal: a second
 * start joins it. While research reads a new exam's notice, the questions first wait for its
 * formats, or a language certificate's blueprint (`waitsForNotice`). A test days away then gets
 * its practice written (`shortPlanPracticeWorkflow`).
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

  // Questions in another format than the exam's would mislead placement (A–D for an exam that
  // judges statements right or wrong), so they wait for its formats while research reads a new
  // notice; a language certificate's wait for its blueprint, which says which skills only
  // recordings practice, so those get no text questions.
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
