import { createEntityStepStream, getAIResultErrorReason } from "@/workflows/_shared/stream-status";
import {
  type ActivityQuizSchema,
  type QuizQuestion,
  generateActivityQuiz,
} from "@zoonk/ai/tasks/activities/core/quiz";
import { type ActivityStepName } from "@zoonk/core/workflows/steps";
import { type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { findActivitiesByKind } from "./_utils/find-activity-by-kind";
import { type ActivitySteps } from "./_utils/get-activity-steps";
import { type LessonActivity } from "./get-lesson-activities-step";
import { handleActivityFailureStep } from "./handle-failure-step";

/**
 * Generates quiz questions from explanation content via AI.
 * Returns the raw questions data without saving to the database.
 * The questions will be passed to `generateQuizImagesStep` for image generation,
 * then to `saveQuizActivityStep` for persistence.
 *
 * No status checks — the caller only passes activities that need generation.
 * Uses safeAsync + handleActivityFailureStep because the quiz depends on
 * explanation data existing — if explanations are empty, that's a permanent
 * failure (not retryable).
 */
export async function generateQuizContentStep(
  activities: LessonActivity[],
  explanationSteps: ActivitySteps,
  workflowRunId: string,
  quizIndex = 0,
): Promise<{ activityId: string | null; questions: QuizQuestion[] }> {
  "use step";

  const quizActivity = findActivitiesByKind(activities, "quiz")[quizIndex];

  if (!quizActivity) {
    return { activityId: null, questions: [] };
  }

  if (explanationSteps.length === 0) {
    await handleActivityFailureStep({ activityId: quizActivity.id });
    return { activityId: null, questions: [] };
  }

  await using stream = createEntityStepStream<ActivityStepName>(quizActivity.id);

  await stream.status({ status: "started", step: "generateQuizContent" });

  const { data: result, error }: SafeReturn<{ data: ActivityQuizSchema }> = await safeAsync(() =>
    generateActivityQuiz({
      chapterTitle: quizActivity.lesson.chapter.title,
      courseTitle: quizActivity.lesson.chapter.course.title,
      explanationSteps,
      language: quizActivity.language,
      lessonDescription: quizActivity.lesson.description ?? "",
      lessonTitle: quizActivity.lesson.title,
    }),
  );

  if (error || !result || result.data.questions.length === 0) {
    const reason = getAIResultErrorReason({ error, result });
    await stream.error({ reason, step: "generateQuizContent" });
    await handleActivityFailureStep({ activityId: quizActivity.id });
    return { activityId: null, questions: [] };
  }

  await stream.status({ status: "completed", step: "generateQuizContent" });
  return { activityId: quizActivity.id, questions: result.data.questions };
}
