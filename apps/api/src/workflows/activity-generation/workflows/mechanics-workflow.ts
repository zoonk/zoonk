import { getWorkflowMetadata } from "workflow";
import { getDependencyContentStep } from "../steps/_shared/get-dependency-content-step";
import { generateImagesStep } from "../steps/generate-images-step";
import { generateMechanicsContentStep } from "../steps/generate-mechanics-content-step";
import { generateVisualsStep } from "../steps/generate-visuals-step";
import { type LessonActivity } from "../steps/get-lesson-activities-step";
import { saveActivityStep } from "../steps/save-activity-step";

/**
 * Mechanics activity workflow.
 * Depends on: explanation
 *
 * Flow: wait for explanation → content → visuals → images → save
 * No dependents currently - no need to notify.
 */
export async function mechanicsWorkflow(
  activities: LessonActivity[],
  lessonId: number,
): Promise<void> {
  "use workflow";

  const { workflowRunId } = getWorkflowMetadata();
  const activity = activities.find((a) => a.kind === "mechanics");

  if (!activity) {
    return;
  }

  // Already completed - nothing to do
  if (activity.generationStatus === "completed" && activity._count.steps > 0) {
    return;
  }

  // Already running - skip to avoid duplicate work
  if (activity.generationStatus === "running") {
    return;
  }

  // Get or wait for explanation content (suspends if not ready)
  const explanationSteps = await getDependencyContentStep({
    activities,
    dependencyKind: "explanation",
    lessonId,
  });

  if (explanationSteps.length === 0) {
    return;
  }

  // Generate content
  const content = await generateMechanicsContentStep(activity, explanationSteps, workflowRunId);

  if (content.steps.length === 0) {
    return;
  }

  // Visuals and images
  const visuals = await generateVisualsStep(activities, content.steps, "mechanics");
  const images = await generateImagesStep(activities, visuals.visuals, "mechanics");

  await saveActivityStep(activities, content.steps, images, workflowRunId, "mechanics");
}
