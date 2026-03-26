import { createStepStream, getAIResultErrorReason } from "@/workflows/_shared/stream-status";
import {
  type ActivityChallengeSchema,
  generateActivityChallenge,
} from "@zoonk/ai/tasks/activities/core/challenge";
import { type ActivityStepName } from "@zoonk/core/workflows/steps";
import { type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { type LessonActivity } from "./get-lesson-activities-step";
import { handleActivityFailureStep } from "./handle-failure-step";

/**
 * Generates challenge content (intro, decision steps, reflection) via AI.
 * Returns the raw data without saving to the database.
 * The data will be passed to `saveChallengeActivityStep` for persistence.
 *
 * No status checks — the caller only passes activities that need generation.
 * Uses safeAsync because empty concepts represent a permanent failure.
 */
export async function generateChallengeContentStep(
  activity: LessonActivity,
  concepts: string[],
  neighboringConcepts: string[],
): Promise<{ activityId: number | null; data: ActivityChallengeSchema | null }> {
  "use step";

  if (concepts.length === 0) {
    await handleActivityFailureStep({ activityId: activity.id });
    return { activityId: null, data: null };
  }

  await using stream = createStepStream<ActivityStepName>();

  await stream.status({ status: "started", step: "generateChallengeContent" });

  const { data: result, error }: SafeReturn<{ data: ActivityChallengeSchema }> = await safeAsync(
    () =>
      generateActivityChallenge({
        chapterTitle: activity.lesson.chapter.title,
        concepts,
        courseTitle: activity.lesson.chapter.course.title,
        language: activity.language,
        lessonDescription: activity.lesson.description ?? "",
        lessonTitle: activity.lesson.title,
        neighboringConcepts,
      }),
  );

  if (error || !result || result.data.steps.length === 0) {
    const reason = getAIResultErrorReason(error, result);
    await stream.error({ reason, step: "generateChallengeContent" });
    await handleActivityFailureStep({ activityId: activity.id });
    return { activityId: null, data: null };
  }

  await stream.status({ status: "completed", step: "generateChallengeContent" });
  return { activityId: Number(activity.id), data: result.data };
}
