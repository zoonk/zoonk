import { createStepStream, getAIResultErrorReason } from "@/workflows/_shared/stream-status";
import {
  type ActivityQuizSchema,
  type QuizQuestion,
  generateActivityQuiz,
} from "@zoonk/ai/tasks/activities/core/quiz";
import { type ActivityStepName } from "@zoonk/core/workflows/steps";
import { type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { resolveActivityForGeneration } from "./_utils/content-step-helpers";
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
 * Unlike other generate steps, this one uses safeAsync + handleActivityFailureStep
 * because the quiz depends on explanation data existing — if explanations are empty,
 * that's a permanent failure (not retryable).
 */
export async function generateQuizContentStep(
  activities: LessonActivity[],
  explanationSteps: ActivitySteps,
  workflowRunId: string,
  quizIndex = 0,
): Promise<{ activityId: number | null; questions: QuizQuestion[] }> {
  "use step";

  const quizActivity = findActivitiesByKind(activities, "quiz")[quizIndex];

  if (!quizActivity) {
    return { activityId: null, questions: [] };
  }

  const resolved = await resolveActivityForGeneration(quizActivity);

  if (!resolved.shouldGenerate) {
    return { activityId: null, questions: [] };
  }

  const { activity } = resolved;

  if (explanationSteps.length === 0) {
    await handleActivityFailureStep({ activityId: activity.id });
    return { activityId: null, questions: [] };
  }

  await using stream = createStepStream<ActivityStepName>();

  await stream.status({ status: "started", step: "generateQuizContent" });

  const { data: result, error }: SafeReturn<{ data: ActivityQuizSchema }> = await safeAsync(() =>
    generateActivityQuiz({
      chapterTitle: activity.lesson.chapter.title,
      courseTitle: activity.lesson.chapter.course.title,
      explanationSteps,
      language: activity.language,
      lessonDescription: activity.lesson.description ?? "",
      lessonTitle: activity.lesson.title,
    }),
  );

  if (error || !result || result.data.questions.length === 0) {
    const reason = getAIResultErrorReason(error, result);
    await stream.error({ reason, step: "generateQuizContent" });
    await handleActivityFailureStep({ activityId: activity.id });
    return { activityId: null, questions: [] };
  }

  await stream.status({ status: "completed", step: "generateQuizContent" });
  return { activityId: Number(activity.id), questions: result.data.questions };
}
