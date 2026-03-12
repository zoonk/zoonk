import { completeActivityStep } from "../steps/complete-activity-step";
import { type ExplanationResult } from "../steps/generate-explanation-content-step";
import { generateQuizContentStep } from "../steps/generate-quiz-content-step";
import { generateQuizImagesStep } from "../steps/generate-quiz-images-step";
import { type LessonActivity } from "../steps/get-lesson-activities-step";

export async function quizActivityWorkflow(
  activities: LessonActivity[],
  workflowRunId: string,
  explanationResults: ExplanationResult[],
): Promise<void> {
  "use workflow";

  const explanationSteps = explanationResults.flatMap((result) => result.steps);
  const { questions } = await generateQuizContentStep(activities, explanationSteps, workflowRunId);
  await generateQuizImagesStep(activities, questions);
  await completeActivityStep(activities, workflowRunId, "quiz");
}
