import { getWorkflowMetadata } from "workflow";
import { type ContentAnalytics } from "../_shared/content-analytics";
import { outlinePlanAhead } from "../goals/goal-outlines";

export type GuestOutlineInput = {
  analytics: ContentAnalytics;
  goalId: string;
  lessonsAskedAt?: number | null;
};

export async function guestOutlineWorkflow({
  analytics,
  goalId,
  lessonsAskedAt,
}: GuestOutlineInput) {
  "use workflow";

  const { workflowRunId } = getWorkflowMetadata();

  await outlinePlanAhead({
    context: { analytics, workflowRunId },
    forGuest: true,
    goalId,
    lessonsAskedAt,
  });
}
