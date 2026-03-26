import { createStepStream, getAIResultErrorReason } from "@/workflows/_shared/stream-status";
import {
  type ActivityPracticeSchema,
  generateActivityPractice,
} from "@zoonk/ai/tasks/activities/core/practice";
import { type ActivityStepName } from "@zoonk/core/workflows/steps";
import { type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { findActivitiesByKind } from "./_utils/find-activity-by-kind";
import { type ActivitySteps } from "./_utils/get-activity-steps";
import { type LessonActivity } from "./get-lesson-activities-step";
import { handleActivityFailureStep } from "./handle-failure-step";

export type PracticeStep = ActivityPracticeSchema["steps"][number];

/**
 * Generates practice questions from explanation content via AI.
 * Returns the raw steps data without saving to the database.
 * The steps will be passed to `savePracticeActivityStep` for persistence.
 *
 * No status checks — the caller only passes activities that need generation.
 * Like the quiz step, this uses safeAsync because empty explanations
 * represent a permanent failure (not retryable).
 */
export async function generatePracticeContentStep(
  activities: LessonActivity[],
  explanationSteps: ActivitySteps,
  workflowRunId: string,
  practiceIndex = 0,
): Promise<{ activityId: number | null; steps: PracticeStep[] }> {
  "use step";

  const practiceActivity = findActivitiesByKind(activities, "practice")[practiceIndex];

  if (!practiceActivity) {
    return { activityId: null, steps: [] };
  }

  if (explanationSteps.length === 0) {
    await handleActivityFailureStep({ activityId: practiceActivity.id });
    return { activityId: null, steps: [] };
  }

  await using stream = createStepStream<ActivityStepName>();

  await stream.status({ status: "started", step: "generatePracticeContent" });

  const { data: result, error }: SafeReturn<{ data: ActivityPracticeSchema }> = await safeAsync(
    () =>
      generateActivityPractice({
        chapterTitle: practiceActivity.lesson.chapter.title,
        courseTitle: practiceActivity.lesson.chapter.course.title,
        explanationSteps,
        language: practiceActivity.language,
        lessonDescription: practiceActivity.lesson.description ?? "",
        lessonTitle: practiceActivity.lesson.title,
      }),
  );

  if (error || !result || result.data.steps.length === 0) {
    const reason = getAIResultErrorReason(error, result);
    await stream.error({ reason, step: "generatePracticeContent" });
    await handleActivityFailureStep({ activityId: practiceActivity.id });
    return { activityId: null, steps: [] };
  }

  await stream.status({ status: "completed", step: "generatePracticeContent" });
  return { activityId: Number(practiceActivity.id), steps: result.data.steps };
}
