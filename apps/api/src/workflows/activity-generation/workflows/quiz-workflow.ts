import { getWorkflowMetadata } from "workflow";
import { getDependencyContentStep } from "../steps/_shared/get-dependency-content-step";
import { generateQuizContentStep } from "../steps/generate-quiz-content-step";
import { generateQuizImagesStep } from "../steps/generate-quiz-images-step";
import { type LessonActivity } from "../steps/get-lesson-activities-step";
import { saveQuizActivityStep } from "../steps/save-quiz-activity-step";

/**
 * Quiz activity workflow.
 * Depends on: explanation
 *
 * Flow: wait for explanation → content → images → save
 * Quiz has different structure - no visuals step, but has quiz images for selectImage questions.
 */
export async function quizWorkflow(activities: LessonActivity[], lessonId: number): Promise<void> {
  "use workflow";

  const { workflowRunId } = getWorkflowMetadata();
  const activity = activities.find((a) => a.kind === "quiz");

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

  // Generate quiz content
  const content = await generateQuizContentStep(activity, explanationSteps, workflowRunId);

  if (content.questions.length === 0) {
    return;
  }

  // Generate images for selectImage questions
  const quizWithImages = await generateQuizImagesStep(activities, content.questions);

  await saveQuizActivityStep(activities, quizWithImages, workflowRunId);
}
