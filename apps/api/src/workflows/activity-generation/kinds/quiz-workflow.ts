import { settled } from "@zoonk/utils/settled";
import { type ActivitySteps } from "../steps/_utils/get-activity-steps";
import { completeActivityStep } from "../steps/complete-activity-step";
import { type ExplanationResult } from "../steps/generate-explanation-content-step";
import { generateQuizContentStep } from "../steps/generate-quiz-content-step";
import { generateQuizImagesStep } from "../steps/generate-quiz-images-step";
import { type LessonActivity } from "../steps/get-lesson-activities-step";

function getExplanationStepsForQuiz(
  explanationResults: ExplanationResult[],
  quizIndex: number,
  totalQuizzes: number,
): ActivitySteps {
  if (totalQuizzes <= 1) {
    return explanationResults.flatMap((result) => result.steps);
  }

  const splitIndex = Math.max(1, Math.floor(explanationResults.length / 2));
  const group =
    quizIndex === 0
      ? explanationResults.slice(0, splitIndex)
      : explanationResults.slice(splitIndex);

  return group.flatMap((result) => result.steps);
}

export async function quizActivityWorkflow(
  activities: LessonActivity[],
  workflowRunId: string,
  explanationResults: ExplanationResult[],
  totalQuizzes: number,
): Promise<void> {
  "use workflow";

  const quizIndices = Array.from({ length: totalQuizzes }, (_, i) => i);

  const quizResults = await Promise.allSettled(
    quizIndices.map((quizIndex) =>
      generateQuizContentStep(
        activities,
        getExplanationStepsForQuiz(explanationResults, quizIndex, totalQuizzes),
        workflowRunId,
        quizIndex,
      ),
    ),
  );

  const quizzes = quizResults.map((result) => settled(result, { questions: [] }));

  await Promise.allSettled(
    quizzes.map((quiz, quizIndex) => generateQuizImagesStep(activities, quiz.questions, quizIndex)),
  );

  await completeActivityStep(activities, workflowRunId, "quiz");
}
