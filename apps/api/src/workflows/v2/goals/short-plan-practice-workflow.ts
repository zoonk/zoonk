import { type ShortPlanPracticeNeed } from "@zoonk/core/lookahead/short-plan-practice";
import { createHook, getWorkflowMetadata } from "workflow";
import { type ContentAnalytics } from "../_shared/content-analytics";
import { preparePlacementItems } from "./placement-items";

export type ShortPlanPracticeInput = {
  analytics?: ContentAnalytics;
  goalId: string;
  need: ShortPlanPracticeNeed;
};

export type ShortPlanPracticeResult = { status: "joined" | "written" };

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

  await preparePlacementItems({
    analytics,
    goalId,
    quickCount: need.questionsPerSkill,
    quickNeeded: need.questionsPerSkill,
    skillIds: need.skillIds,
    workflowRunId,
  });

  return { status: "written" };
}
