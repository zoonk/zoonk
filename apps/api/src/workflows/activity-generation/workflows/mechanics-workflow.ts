import { getWorkflowMetadata } from "workflow";
import { getWorkflowAction } from "../steps/_utils/should-run-workflow";
import { waitForDependencyWithTimeout } from "../steps/_utils/wait-for-dependency-with-timeout";
import { generateImagesStep } from "../steps/generate-images-step";
import { generateMechanicsContentStep } from "../steps/generate-mechanics-content-step";
import { generateVisualsStep } from "../steps/generate-visuals-step";
import { type LessonActivity } from "../steps/get-lesson-activities-step";
import { handleActivityFailureStep } from "../steps/handle-failure-step";
import { saveActivityStep } from "../steps/save-activity-step";

/**
 * Mechanics activity workflow.
 * Depends on: explanation
 *
 * Flow: wait for explanation → content → visuals → images → save
 *
 * Design decisions:
 * - Uses 10m timeout to prevent infinite hanging on hook waits
 * - No dependents currently - no need to notify
 * - Marks activity as "failed" when dependency times out or AI returns empty steps
 */
export async function mechanicsWorkflow(
  activities: LessonActivity[],
  lessonId: number,
): Promise<void> {
  "use workflow";

  const { workflowRunId } = getWorkflowMetadata();
  const activity = activities.find((a) => a.kind === "mechanics");
  const action = getWorkflowAction(activity);

  if (action === "skip" || !activity) {
    return;
  }
  if (action === "notifyOnly") {
    return;
  }

  const explanationSteps = await waitForDependencyWithTimeout({
    activities,
    dependencyKind: "explanation",
    lessonId,
  });

  // Dependency failed or timed out - mark as failed
  if (explanationSteps.length === 0) {
    await handleActivityFailureStep({ activityId: activity.id });
    return;
  }

  const content = await generateMechanicsContentStep(activity, explanationSteps, workflowRunId);

  // Empty steps indicates AI generation error - mark as failed
  if (content.steps.length === 0) {
    await handleActivityFailureStep({ activityId: activity.id });
    return;
  }

  const visuals = await generateVisualsStep(activities, content.steps, "mechanics");
  const images = await generateImagesStep(activities, visuals.visuals, "mechanics");

  await saveActivityStep(activities, content.steps, images, workflowRunId, "mechanics");
}
