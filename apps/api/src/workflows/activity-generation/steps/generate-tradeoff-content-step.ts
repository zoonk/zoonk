import { createEntityStepStream, getAIResultErrorReason } from "@/workflows/_shared/stream-status";
import {
  type ActivityTradeoffSchema,
  generateActivityTradeoff,
} from "@zoonk/ai/tasks/activities/core/tradeoff";
import { type ActivityStepName } from "@zoonk/core/workflows/steps";
import { type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { findActivitiesByKind } from "./_utils/find-activity-by-kind";
import { type ActivitySteps } from "./_utils/get-activity-steps";
import { type LessonActivity } from "./get-lesson-activities-step";
import { handleActivityFailureStep } from "./handle-failure-step";

/**
 * Generates a tradeoff scenario from explanation content via AI.
 *
 * Returns the full AI output (scenario, priorities, rounds, reflection)
 * without saving to the database. The save step splits this into
 * individual step records.
 *
 * The AI decides how many rounds to generate (2-4) based on topic
 * complexity. Simple topics get fewer rounds, complex ones get more.
 */
export async function generateTradeoffContentStep(
  activities: LessonActivity[],
  explanationSteps: ActivitySteps,
  _workflowRunId: string,
): Promise<{ activityId: number | null; content: ActivityTradeoffSchema | null }> {
  "use step";

  const tradeoffActivity = findActivitiesByKind(activities, "tradeoff")[0];

  if (!tradeoffActivity) {
    return { activityId: null, content: null };
  }

  if (explanationSteps.length === 0) {
    await handleActivityFailureStep({ activityId: tradeoffActivity.id });
    return { activityId: null, content: null };
  }

  await using stream = createEntityStepStream<ActivityStepName>(tradeoffActivity.id);

  await stream.status({ status: "started", step: "generateTradeoffContent" });

  const { data: result, error }: SafeReturn<{ data: ActivityTradeoffSchema }> = await safeAsync(
    () =>
      generateActivityTradeoff({
        chapterTitle: tradeoffActivity.lesson.chapter.title,
        courseTitle: tradeoffActivity.lesson.chapter.course.title,
        explanationSteps,
        language: tradeoffActivity.language,
        lessonDescription: tradeoffActivity.lesson.description ?? "",
        lessonTitle: tradeoffActivity.lesson.title,
      }),
  );

  if (error || !result || result.data.rounds.length === 0) {
    const reason = getAIResultErrorReason({ error, result });
    await stream.error({ reason, step: "generateTradeoffContent" });
    await handleActivityFailureStep({ activityId: tradeoffActivity.id });
    return { activityId: null, content: null };
  }

  await stream.status({ status: "completed", step: "generateTradeoffContent" });
  return { activityId: Number(tradeoffActivity.id), content: result.data };
}
