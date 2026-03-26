import { type ExplanationResult } from "../steps/generate-explanation-content-step";
import { generateQuizContentStep } from "../steps/generate-quiz-content-step";
import { generateQuizImagesStep } from "../steps/generate-quiz-images-step";
import { type LessonActivity } from "../steps/get-lesson-activities-step";
import { saveQuizActivityStep } from "../steps/save-quiz-activity-step";

/**
 * Orchestrates quiz activity generation.
 *
 * Flow: generateContent → generateImages → save.
 * The generate steps produce data only; the save step writes everything
 * and marks the activity as completed.
 */
export async function quizActivityWorkflow(
  activities: LessonActivity[],
  workflowRunId: string,
  explanationResults: ExplanationResult[],
): Promise<void> {
  "use workflow";

  const explanationSteps = explanationResults.flatMap((result) => result.steps);
  const { activityId, questions } = await generateQuizContentStep(
    activities,
    explanationSteps,
    workflowRunId,
  );

  if (!activityId || questions.length === 0) {
    return;
  }

  const questionsWithImages = await generateQuizImagesStep(activities, questions);
  const finalQuestions = questionsWithImages.length > 0 ? questionsWithImages : questions;

  await saveQuizActivityStep({
    activityId,
    questions: finalQuestions,
    workflowRunId,
  });
}
