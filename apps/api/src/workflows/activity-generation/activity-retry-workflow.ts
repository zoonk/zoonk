import { getActivityInfoStep } from "./steps/get-activity-info-step";
import { getLessonActivitiesStep } from "./steps/get-lesson-activities-step";
import { resetActivityStatusStep } from "./steps/reset-activity-status-step";
import { runActivityWorkflowStep } from "./steps/run-activity-workflow-step";

/**
 * Retries generation for a single activity.
 *
 * Resets the activity status to pending, then runs the appropriate workflow.
 * Data-driven resumption in each workflow will skip already-completed phases.
 */
export async function activityRetryWorkflow(activityId: bigint): Promise<void> {
  "use workflow";

  // Get activity details to know which workflow to run
  const activityInfo = await getActivityInfoStep(activityId);

  // Reset activity status
  await resetActivityStatusStep(activityId);

  // Get full lesson activities (needed by workflows)
  const activities = await getLessonActivitiesStep(activityInfo.lessonId);

  // Run the appropriate workflow
  await runActivityWorkflowStep(activityInfo.kind, activities, activityInfo.lessonId);
}
