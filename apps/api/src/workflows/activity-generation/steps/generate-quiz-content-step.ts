import { createEntityStepStream, getAIResultErrorReason } from "@/workflows/_shared/stream-status";
import {
  type ActivityQuizSchema,
  type QuizQuestion,
  generateActivityQuiz,
} from "@zoonk/ai/tasks/activities/core/quiz";
import { type ActivityStepName } from "@zoonk/core/workflows/steps";
import { type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { FatalError } from "workflow";
import { findActivitiesByKind } from "./_utils/find-activity-by-kind";
import { type ActivitySteps } from "./_utils/get-activity-steps";
import { type LessonActivity } from "./get-lesson-activities-step";

/**
 * Generates quiz questions from explanation content via AI.
 * Returns the raw questions data without saving to the database.
 * The questions will be passed to `generateQuizImagesStep` for image generation,
 * then to `saveQuizActivityStep` for persistence.
 *
 * No status checks — the caller only passes activities that need generation.
 * Empty explanation data is a permanent dependency failure, so the step throws
 * `FatalError` for that case. AI/provider errors still throw the original
 * error so Workflow can retry the step before the quiz activity is marked
 * failed by the kind-level catch block.
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
    throw new FatalError("Quiz generation needs explanation steps");
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
    throw error ?? new Error(getAIResultErrorReason({ result }));
  }

  await stream.status({ status: "completed", step: "generateQuizContent" });
  return { activityId: quizActivity.id, questions: result.data.questions };
}
