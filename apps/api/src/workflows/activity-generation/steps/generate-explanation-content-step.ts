import { createStepStream } from "@/workflows/_shared/stream-status";
import { type ActivityStepName } from "@/workflows/config";
import { generateActivityExplanation } from "@zoonk/ai/tasks/activities/core/explanation";
import { safeAsync } from "@zoonk/utils/error";
import { rejected, settledValues } from "@zoonk/utils/settled";
import { resolveActivityForGeneration, saveContentSteps } from "./_utils/content-step-helpers";
import { findActivitiesByKind } from "./_utils/find-activity-by-kind";
import { type ActivitySteps } from "./_utils/get-activity-steps";
import { type LessonActivity } from "./get-lesson-activities-step";
import { handleActivityFailureStep } from "./handle-failure-step";
import { setActivityAsRunningStep } from "./set-activity-as-running-step";

export type ExplanationResult = {
  activityId: number;
  concept: string;
  steps: ActivitySteps;
};

async function generateSingleExplanation(
  activity: LessonActivity,
  concept: string,
  neighboringConcepts: string[],
  workflowRunId: string,
): Promise<ExplanationResult> {
  const resolved = await resolveActivityForGeneration(activity);

  if (!resolved.shouldGenerate) {
    return { activityId: activity.id, concept, steps: resolved.existingSteps };
  }

  await setActivityAsRunningStep({ activityId: activity.id, workflowRunId });

  const { data: result, error } = await safeAsync(() =>
    generateActivityExplanation({
      chapterTitle: activity.lesson.chapter.title,
      concept,
      courseTitle: activity.lesson.chapter.course.title,
      language: activity.language,
      lessonDescription: activity.lesson.description ?? "",
      lessonTitle: activity.lesson.title,
      neighboringConcepts,
    }),
  );

  if (error || !result) {
    await handleActivityFailureStep({ activityId: activity.id });
    throw error ?? new Error("Empty AI result");
  }

  const { error: saveError } = await saveContentSteps(activity.id, result.data.steps);

  if (saveError) {
    await handleActivityFailureStep({ activityId: activity.id });
    throw saveError;
  }

  return { activityId: activity.id, concept, steps: result.data.steps };
}

export async function generateExplanationContentStep(
  activities: LessonActivity[],
  concepts: string[],
  neighboringConcepts: string[],
  workflowRunId: string,
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

      return generateSingleExplanation(
        activity,
        concept,
        [...otherLessonConcepts, ...neighboringConcepts],
        workflowRunId,
      );
    }),
  );

  await stream.status({
    status: rejected(allSettled) ? "error" : "completed",
    step: "generateExplanationContent",
  });

  return { results: settledValues(allSettled) };
}
