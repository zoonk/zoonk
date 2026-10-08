import { type ShortPlanPracticeNeed } from "@zoonk/core/lookahead/short-plan-practice";
import { createHook, getWorkflowMetadata } from "workflow";
import { type ContentAnalytics } from "../_shared/content-analytics";
import { preparePlacementItemsStep } from "./steps/goal-lookahead-steps";

export type ShortPlanPracticeInput = {
  analytics?: ContentAnalytics;
  goalId: string;
  need: ShortPlanPracticeNeed;
};

export type ShortPlanPracticeResult = { status: "joined" | "written" };

/**
 * Writes the practice a test days away needs once placement's questions are in: a class test on
 * Friday spends its days practicing (all of them when placement tested its lessons out) and on
 * its short mock, so each skill gets a bank sized to the days' time (see
 * `getShortPlanPracticeNeed`). Skills that already have that many are left as they are. A run of
 * its own, after placement's, so placement never waits on it. One run per goal: a second start
 * joins it.
 */
export async function shortPlanPracticeWorkflow(
  input: ShortPlanPracticeInput,
): Promise<ShortPlanPracticeResult> {
  "use workflow";

  const { analytics, goalId, need } = input;
  const { workflowRunId } = getWorkflowMetadata();
  const hook = createHook({ token: `short-plan-practice:${goalId}` });

  if (await hook.getConflict()) {
    return { status: "joined" };
  }

  await preparePlacementItemsStep({
    analytics,
    goalId,
    quickCount: need.questionsPerSkill,
    quickNeeded: need.questionsPerSkill,
    skillIds: need.skillIds,
    workflowRunId,
  });

  return { status: "written" };
}
