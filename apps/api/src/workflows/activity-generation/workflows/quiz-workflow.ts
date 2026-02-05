import { getWorkflowMetadata } from "workflow";
import { getWorkflowAction } from "../steps/_utils/should-run-workflow";
import { waitForDependencyWithTimeout } from "../steps/_utils/wait-for-dependency-with-timeout";
import { generateQuizContentStep } from "../steps/generate-quiz-content-step";
import { generateQuizImagesStep } from "../steps/generate-quiz-images-step";
import { type LessonActivity } from "../steps/get-lesson-activities-step";
import { handleActivityFailureStep } from "../steps/handle-failure-step";
import { saveQuizActivityStep } from "../steps/save-quiz-activity-step";

/**
 * Quiz activity workflow.
 * Depends on: explanation
 *
 * Flow: wait for explanation → content → images → save
 *
 * Design decisions:
 * - Uses 10m timeout to prevent infinite hanging on hook waits
 * - Quiz has different structure - no visuals step, but has quiz images for selectImage questions
 * - Marks activity as "failed" when dependency times out or AI returns empty questions
 */
export async function quizWorkflow(activities: LessonActivity[], lessonId: number): Promise<void> {
  "use workflow";

  const { workflowRunId } = getWorkflowMetadata();
  const activity = activities.find((a) => a.kind === "quiz");
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

  const content = await generateQuizContentStep(activity, explanationSteps, workflowRunId);

  // Empty questions indicates AI generation error - mark as failed
  if (content.questions.length === 0) {
    await handleActivityFailureStep({ activityId: activity.id });
    return;
  }

  const quizWithImages = await generateQuizImagesStep(activities, content.questions);

  await saveQuizActivityStep(activities, quizWithImages, workflowRunId);
}
