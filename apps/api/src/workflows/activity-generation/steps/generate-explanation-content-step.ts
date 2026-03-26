import { createStepStream } from "@/workflows/_shared/stream-status";
import { type ActivityStepName } from "@/workflows/config";
import { generateActivityExplanation } from "@zoonk/ai/tasks/activities/core/explanation";
import { rejected, settledValues } from "@zoonk/utils/settled";
import { resolveActivityForGeneration } from "./_utils/content-step-helpers";
import { findActivitiesByKind } from "./_utils/find-activity-by-kind";
import { type ActivitySteps } from "./_utils/get-activity-steps";
import { type LessonActivity } from "./get-lesson-activities-step";

export type ExplanationResult = {
  activityId: number;
  concept: string;
  steps: ActivitySteps;
};

/**
 * Generates explanation content for a single activity via AI.
 * Pure data producer: no DB writes. On failure, throws to let
 * the workflow framework retry. The orchestration level handles
 * failure marking via `handleActivityFailureStep`.
 */
async function generateSingleExplanation(
  activity: LessonActivity,
  concept: string,
  neighboringConcepts: string[],
): Promise<ExplanationResult> {
  const resolved = await resolveActivityForGeneration(activity);

  if (!resolved.shouldGenerate) {
    return { activityId: activity.id, concept, steps: resolved.existingSteps };
  }

  const result = await generateActivityExplanation({
    chapterTitle: activity.lesson.chapter.title,
    concept,
    courseTitle: activity.lesson.chapter.course.title,
    language: activity.language,
    lessonDescription: activity.lesson.description ?? "",
    lessonTitle: activity.lesson.title,
    neighboringConcepts,
  });

  if (!result?.data?.steps || result.data.steps.length === 0) {
    throw new Error("Empty AI result for explanation content");
  }

  return { activityId: activity.id, concept, steps: result.data.steps };
}

/**
 * Generates explanation content for all explanation activities in parallel.
 * Returns the raw content data without saving to the database.
 * Each activity's content will be persisted later by `saveExplanationActivityStep`.
 */
export async function generateExplanationContentStep(
  activities: LessonActivity[],
  concepts: string[],
  neighboringConcepts: string[],
): Promise<{ results: ExplanationResult[] }> {
  "use step";

  const explanationActivities = findActivitiesByKind(activities, "explanation");

  if (explanationActivities.length === 0) {
    return { results: [] };
  }

  await using stream = createStepStream<ActivityStepName>();

  await stream.status({ status: "started", step: "generateExplanationContent" });

  const allSettled = await Promise.allSettled(
    explanationActivities.map((activity) => {
      const concept = activity.title ?? "";
      const otherLessonConcepts = concepts.filter((item) => item !== concept);

      return generateSingleExplanation(activity, concept, [
        ...otherLessonConcepts,
        ...neighboringConcepts,
      ]);
    }),
  );

  await stream.status({
    status: rejected(allSettled) ? "error" : "completed",
    step: "generateExplanationContent",
  });

  return { results: settledValues(allSettled) };
}
