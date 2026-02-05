import { getWorkflowMetadata } from "workflow";
import { notifyDependentsStep } from "../steps/_shared/notify-dependents-step";
import { getWorkflowAction } from "../steps/_utils/should-run-workflow";
import { generateBackgroundContentStep } from "../steps/generate-background-content-step";
import { generateImagesStep } from "../steps/generate-images-step";
import { generateVisualsStep } from "../steps/generate-visuals-step";
import { type LessonActivity } from "../steps/get-lesson-activities-step";
import { handleActivityFailureStep } from "../steps/handle-failure-step";
import { saveActivityStep } from "../steps/save-activity-step";

/**
 * Background activity workflow.
 * No dependencies - runs immediately.
 *
 * Flow: content → notify dependents → visuals → images → save
 *
 * Design decisions:
 * - Notifies after content so dependents (explanation) can start in parallel with visuals
 * - Always notifies dependents even on failure so they don't hang waiting
 * - Marks activity as "failed" when AI returns empty steps (generation error)
 */
export async function backgroundWorkflow(
  activities: LessonActivity[],
  lessonId: number,
): Promise<void> {
  "use workflow";

  const { workflowRunId } = getWorkflowMetadata();
  const activity = activities.find((a) => a.kind === "background");
  const action = getWorkflowAction(activity);

  if (action === "skip" || !activity) {
    return;
  }

  if (action === "notifyOnly") {
    await notifyDependentsStep({
      activityId: activity.id,
      activityKind: "background",
      lessonId,
    });
    return;
  }

  // Generate content
  const content = await generateBackgroundContentStep(activity, workflowRunId);

  // Always notify dependents so they don't hang waiting (even with empty steps)
  await notifyDependentsStep({
    activityId: activity.id,
    activityKind: "background",
    lessonId,
    steps: content.steps,
  });

  // Empty steps indicates AI generation error - mark as failed
  if (content.steps.length === 0) {
    await handleActivityFailureStep({ activityId: activity.id });
    return;
  }

  // Continue with visuals and images (in parallel with dependents)
  const visuals = await generateVisualsStep(activities, content.steps, "background");
  const images = await generateImagesStep(activities, visuals.visuals, "background");

  await saveActivityStep(activities, content.steps, images, workflowRunId, "background");
}
