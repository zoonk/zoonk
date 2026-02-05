import { getWorkflowMetadata } from "workflow";
import { notifyDependentsStep } from "../steps/_shared/notify-dependents-step";
import { getWorkflowAction } from "../steps/_utils/should-run-workflow";
import { waitForDependencyWithTimeout } from "../steps/_utils/wait-for-dependency-with-timeout";
import { generateExplanationContentStep } from "../steps/generate-explanation-content-step";
import { generateImagesStep } from "../steps/generate-images-step";
import { generateVisualsStep } from "../steps/generate-visuals-step";
import { type LessonActivity } from "../steps/get-lesson-activities-step";
import { handleActivityFailureStep } from "../steps/handle-failure-step";
import { saveActivityStep } from "../steps/save-activity-step";

async function handleExplanationFailure(activity: { id: bigint }, lessonId: number): Promise<void> {
  await notifyDependentsStep({
    activityId: activity.id,
    activityKind: "explanation",
    lessonId,
    steps: [],
  });
  await handleActivityFailureStep({ activityId: activity.id });
}

/**
 * Explanation activity workflow.
 * Depends on: background
 *
 * Flow: wait for background → content → notify dependents → visuals → images → save
 *
 * Design decisions:
 * - Uses 10m timeout to prevent infinite hanging on hook waits
 * - Notifies after content so dependents (mechanics, quiz) can start in parallel with visuals
 * - Always notifies dependents even on failure so they don't hang waiting
 * - Marks activity as "failed" when AI returns empty steps (generation error)
 */
export async function explanationWorkflow(
  activities: LessonActivity[],
  lessonId: number,
): Promise<void> {
  "use workflow";

  const { workflowRunId } = getWorkflowMetadata();
  const activity = activities.find((a) => a.kind === "explanation");
  const action = getWorkflowAction(activity);

  if (action === "skip" || !activity) {
    return;
  }

  if (action === "notifyOnly") {
    await notifyDependentsStep({ activityId: activity.id, activityKind: "explanation", lessonId });
    return;
  }

  const backgroundSteps = await waitForDependencyWithTimeout({
    activities,
    dependencyKind: "background",
    lessonId,
  });

  if (backgroundSteps.length === 0) {
    await handleExplanationFailure(activity, lessonId);
    return;
  }

  const content = await generateExplanationContentStep(activity, backgroundSteps, workflowRunId);

  // Always notify dependents so they don't hang waiting (even with empty steps)
  await notifyDependentsStep({
    activityId: activity.id,
    activityKind: "explanation",
    lessonId,
    steps: content.steps,
  });

  if (content.steps.length === 0) {
    await handleActivityFailureStep({ activityId: activity.id });
    return;
  }

  const visuals = await generateVisualsStep(activities, content.steps, "explanation");
  const images = await generateImagesStep(activities, visuals.visuals, "explanation");

  await saveActivityStep(activities, content.steps, images, workflowRunId, "explanation");
}
