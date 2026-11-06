import { type ShortPlanPracticeNeed } from "@zoonk/core/lookahead/short-plan-practice";
import { getWorkflowMetadata } from "workflow";
import { type ContentAnalytics } from "../_shared/content-analytics";
import { preparePlacementItems } from "./placement-items";

export type ShortPlanPracticeInput = {
  analytics?: ContentAnalytics;
  goalId: string;
  need: ShortPlanPracticeNeed;
};

export function getShortPlanPracticeToken(goalId: string): string {
  return `short-plan-practice:${goalId}`;
}

export async function shortPlanPracticeWorkflow(input: ShortPlanPracticeInput): Promise<void> {
  "use workflow";

  const { analytics, goalId, need } = input;
  const { workflowRunId } = getWorkflowMetadata();

  await preparePlacementItems({
    analytics,
    goalId,
    quickCount: need.questionsPerSkill,
    quickNeeded: need.questionsPerSkill,
    skillIds: need.skillIds,
    workflowRunId,
  });
}
