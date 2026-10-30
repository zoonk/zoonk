import { type OutlineAsk } from "@zoonk/core/lookahead/today-outlines";
import { getWorkflowMetadata } from "workflow";
import { type ContentAnalytics } from "../_shared/content-analytics";
import { outlinePlanAhead } from "../goals/goal-outlines";

export type GuestOutlineInput = {
  analytics: ContentAnalytics;
  askedOutlines?: OutlineAsk[];
  goalId: string;
};

export async function guestOutlineWorkflow({
  analytics,
  askedOutlines,
  goalId,
}: GuestOutlineInput) {
  "use workflow";

  const { workflowRunId } = getWorkflowMetadata();

  await outlinePlanAhead({
    asked: askedOutlines,
    context: { analytics, workflowRunId },
    forGuest: true,
    goalId,
  });
}
