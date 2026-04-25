import { failActivityWorkflow } from "../handle-activity-workflow-error";
import { findActivitiesByKind } from "../steps/_utils/find-activity-by-kind";
import { type ExplanationResult } from "../steps/generate-explanation-content-step";
import { generateQuizContentStep } from "../steps/generate-quiz-content-step";
import { generateQuizImagesStep } from "../steps/generate-quiz-images-step";
import { type LessonActivity } from "../steps/get-lesson-activities-step";
import { saveQuizActivityStep } from "../steps/save-quiz-activity-step";

/**
 * Orchestrates quiz activity generation.
 *
 * Flow: generateContent -> generateImages -> save.
 * The generate steps produce data only; the save step writes everything
 * and marks the activity as completed.
 *
 * Only generates for quiz activities in the activitiesToGenerate list.
 */
export async function quizActivityWorkflow({
  activitiesToGenerate,
  explanationResults,
  workflowRunId,
}: {
  activitiesToGenerate: LessonActivity[];
  explanationResults: ExplanationResult[];
  workflowRunId: string;
}): Promise<void> {
  "use workflow";

  const quizActivity = findActivitiesByKind(activitiesToGenerate, "quiz")[0];

  if (!quizActivity) {
    return;
  }

  const explanationSteps = explanationResults.flatMap((result) => result.steps);

  try {
    const { activityId, questions } = await generateQuizContentStep(
      activitiesToGenerate,
      explanationSteps,
      workflowRunId,
    );

    if (!activityId || questions.length === 0) {
      throw new Error("Quiz content step returned incomplete content");
    }

    const questionsWithImages = await generateQuizImagesStep(activitiesToGenerate, questions);
    const finalQuestions = questionsWithImages.length > 0 ? questionsWithImages : questions;

    await saveQuizActivityStep({
      activityId,
      questions: finalQuestions,
      workflowRunId,
    });
  } catch (error) {
    await failActivityWorkflow({ activityId: quizActivity.id, error });
  }
}
