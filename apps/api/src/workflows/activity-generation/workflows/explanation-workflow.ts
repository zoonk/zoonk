import { getWorkflowMetadata } from "workflow";
import { getDependencyContentStep } from "../steps/_shared/get-dependency-content-step";
import { notifyDependentsStep } from "../steps/_shared/notify-dependents-step";
import { generateExplanationContentStep } from "../steps/generate-explanation-content-step";
import { generateImagesStep } from "../steps/generate-images-step";
import { generateVisualsStep } from "../steps/generate-visuals-step";
import { type LessonActivity } from "../steps/get-lesson-activities-step";
import { saveActivityStep } from "../steps/save-activity-step";

/**
 * Explanation activity workflow.
 * Depends on: background
 *
 * Flow: wait for background → content → notify dependents → visuals → images → save
 * Notifies after content so mechanics and quiz can start in parallel with visuals.
 */
export async function explanationWorkflow(
  activities: LessonActivity[],
  lessonId: number,
): Promise<void> {
  "use workflow";

  const { workflowRunId } = getWorkflowMetadata();
  const activity = activities.find((a) => a.kind === "explanation");

  if (!activity) {
    return;
  }

  // Already completed - just notify dependents (they might be waiting)
  if (activity.generationStatus === "completed" && activity._count.steps > 0) {
    await notifyDependentsStep({
      activityId: activity.id,
      activityKind: "explanation",
      lessonId,
    });
    return;
  }

  // Already running - skip to avoid duplicate work
  if (activity.generationStatus === "running") {
    return;
  }

  // Get or wait for background content (suspends if not ready)
  const backgroundSteps = await getDependencyContentStep({
    activities,
    dependencyKind: "background",
    lessonId,
  });

  // If background has no steps, notify dependents with empty and exit
  if (backgroundSteps.length === 0) {
    await notifyDependentsStep({
      activityId: activity.id,
      activityKind: "explanation",
      lessonId,
      steps: [],
    });
    return;
  }

  // Generate content
  const content = await generateExplanationContentStep(activity, backgroundSteps, workflowRunId);

  // Always notify dependents so they don't hang waiting (even with empty steps)
  await notifyDependentsStep({
    activityId: activity.id,
    activityKind: "explanation",
    lessonId,
    steps: content.steps,
  });

  if (content.steps.length === 0) {
    return;
  }

  // Continue with visuals and images
  const visuals = await generateVisualsStep(activities, content.steps, "explanation");
  const images = await generateImagesStep(activities, visuals.visuals, "explanation");

  await saveActivityStep(activities, content.steps, images, workflowRunId, "explanation");
}
