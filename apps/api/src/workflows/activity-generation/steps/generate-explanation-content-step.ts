import { generateActivityExplanation } from "@zoonk/ai/tasks/activities/core/explanation";
import { safeAsync } from "@zoonk/utils/error";
import { streamError, streamStatus } from "../stream-status";
import { resolveActivitiesForGeneration, saveContentSteps } from "./_utils/content-step-helpers";
import { type ActivitySteps } from "./_utils/get-activity-steps";
import { type LessonActivity } from "./get-lesson-activities-step";
import { handleActivityFailureStep } from "./handle-failure-step";
import { setActivityAsRunningStep } from "./set-activity-as-running-step";

type GeneratedExplanationContent = {
  activityId: bigint | number;
  steps: ActivitySteps;
};

export async function generateExplanationContentStep(
  activities: LessonActivity[],
  workflowRunId: string,
): Promise<{ results: GeneratedExplanationContent[] }> {
  "use step";

  const resolvedActivities = await resolveActivitiesForGeneration(activities, "explanation");

  if (resolvedActivities.length === 0) {
    return { results: [] };
  }

  const results = await Promise.all(
    resolvedActivities.map(async (resolved) => {
      if (!resolved.shouldGenerate) {
        return { activityId: resolved.activity.id, steps: resolved.existingSteps };
      }

      const activity = resolved.activity;
      const concept = activity.title?.trim();

      if (!concept) {
        await streamError({ reason: "noSourceData", step: "generateExplanationContent" });
        await handleActivityFailureStep({ activityId: activity.id });
        return { activityId: activity.id, steps: [] };
      }

      await streamStatus({ status: "started", step: "generateExplanationContent" });
      await setActivityAsRunningStep({ activityId: activity.id, workflowRunId });

      const { data: result, error } = await safeAsync(() =>
        generateActivityExplanation({
          chapterTitle: activity.lesson.chapter.title,
          concept,
          courseTitle: activity.lesson.chapter.course.title,
          language: activity.language,
          lessonDescription: activity.lesson.description ?? "",
          lessonTitle: activity.lesson.title,
        }),
      );

      if (error || !result) {
        const reason = error ? "aiGenerationFailed" : "aiEmptyResult";
        await streamError({ reason, step: "generateExplanationContent" });
        await handleActivityFailureStep({ activityId: activity.id });
        return { activityId: activity.id, steps: [] };
      }

      return saveAndStreamResult(activity.id, result.data.steps);
    }),
  );

  return { results };
}

async function saveAndStreamResult(
  activityId: bigint | number,
  steps: ActivitySteps,
): Promise<GeneratedExplanationContent> {
  const { error } = await saveContentSteps(activityId, steps);

  if (error) {
    await streamError({ reason: "dbSaveFailed", step: "generateExplanationContent" });
    await handleActivityFailureStep({ activityId });
    return { activityId, steps: [] };
  }

  await streamStatus({ status: "completed", step: "generateExplanationContent" });
  return { activityId, steps };
}
