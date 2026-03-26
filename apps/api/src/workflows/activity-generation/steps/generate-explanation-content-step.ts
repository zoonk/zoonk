import { createStepStream } from "@/workflows/_shared/stream-status";
import { generateActivityExplanation } from "@zoonk/ai/tasks/activities/core/explanation";
import { type ActivityStepName } from "@zoonk/core/workflows/steps";
import { rejected, settledValues } from "@zoonk/utils/settled";
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
 *
 * No status checks — the caller only passes activities that need generation.
 */
async function generateSingleExplanation(
  activity: LessonActivity,
  concept: string,
  neighboringConcepts: string[],
): Promise<ExplanationResult> {
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
 *
 * Only receives activities that need generation — no status checks needed.
 */
export async function generateExplanationContentStep(
  activities: LessonActivity[],
  concepts: string[],
  neighboringConcepts: string[],
): Promise<{ results: ExplanationResult[] }> {
  "use step";

  if (activities.length === 0) {
    return { results: [] };
  }

  await using stream = createStepStream<ActivityStepName>();

  await stream.status({ status: "started", step: "generateExplanationContent" });

  const allSettled = await Promise.allSettled(
    activities.map((activity) => {
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
