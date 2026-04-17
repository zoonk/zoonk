import { createStepStream } from "@/workflows/_shared/stream-status";
import { generateActivityExplanation } from "@zoonk/ai/tasks/activities/core/explanation";
import { type ActivityStepName } from "@zoonk/core/workflows/steps";
import { rejected, settledValues } from "@zoonk/utils/settled";
import {
  type ExplanationActivityPlanEntry,
  buildExplanationActivityPlan,
} from "./_utils/build-explanation-activity-plan";
import { type ActivitySteps } from "./_utils/get-activity-steps";
import { type LessonActivity } from "./get-lesson-activities-step";

export type ExplanationResult = {
  activityId: string;
  concept: string;
  steps: ActivitySteps;
};

export type GeneratedExplanationResult = ExplanationResult & {
  plan: ExplanationActivityPlanEntry[];
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
): Promise<GeneratedExplanationResult> {
  const result = await generateActivityExplanation({
    chapterTitle: activity.lesson.chapter.title,
    concept,
    courseTitle: activity.lesson.chapter.course.title,
    language: activity.language,
    lessonDescription: activity.lesson.description ?? "",
    lessonTitle: activity.lesson.title,
    neighboringConcepts,
  });

  if (!result?.data) {
    throw new Error("Empty AI result for explanation content");
  }

  const plan = buildExplanationActivityPlan(result.data);

  if (plan.entries.length === 0 || plan.sourceSteps.length === 0) {
    throw new Error("Empty explanation activity plan");
  }

  return {
    activityId: activity.id,
    concept,
    plan: plan.entries,
    steps: plan.sourceSteps,
  };
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
): Promise<{ results: GeneratedExplanationResult[] }> {
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
