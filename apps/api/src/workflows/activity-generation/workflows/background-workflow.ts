import { getWorkflowMetadata } from "workflow";
import { notifyDependentsStep } from "../steps/_shared/notify-dependents-step";
import { generateBackgroundContentStep } from "../steps/generate-background-content-step";
import { generateImagesStep } from "../steps/generate-images-step";
import { generateVisualsStep } from "../steps/generate-visuals-step";
import { type LessonActivity } from "../steps/get-lesson-activities-step";
import { saveActivityStep } from "../steps/save-activity-step";

/**
 * Background activity workflow.
 * No dependencies - runs immediately.
 *
 * Flow: content → notify dependents → visuals → images → save
 * Notifies after content so explanation can start in parallel with visuals.
 */
export async function backgroundWorkflow(
  activities: LessonActivity[],
  lessonId: number,
): Promise<void> {
  "use workflow";

  const { workflowRunId } = getWorkflowMetadata();
  const activity = activities.find((a) => a.kind === "background");

  if (!activity) {
    return;
  }

  // Already completed - just notify dependents (they might be waiting)
  if (activity.generationStatus === "completed" && activity._count.steps > 0) {
    await notifyDependentsStep({
      activityId: activity.id,
      activityKind: "background",
      lessonId,
    });
    return;
  }

  // Already running - skip to avoid duplicate work
  if (activity.generationStatus === "running") {
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

  if (content.steps.length === 0) {
    return;
  }

  // Continue with visuals and images (in parallel with dependents)
  const visuals = await generateVisualsStep(activities, content.steps, "background");
  const images = await generateImagesStep(activities, visuals.visuals, "background");

  await saveActivityStep(activities, content.steps, images, workflowRunId, "background");
}
