import { generateActivityBackground } from "@zoonk/ai/tasks/activities/core/background";
import { safeAsync } from "@zoonk/utils/error";
import { streamError, streamStatus } from "../stream-status";
import { resolveActivityForGeneration, saveContentSteps } from "./_utils/content-step-helpers";
import { type ActivitySteps } from "./_utils/get-activity-steps";
import { type LessonActivity } from "./get-lesson-activities-step";
import { handleActivityFailureStep } from "./handle-failure-step";
import { setActivityAsRunningStep } from "./set-activity-as-running-step";

export async function generateBackgroundContentStep(
  activities: LessonActivity[],
  workflowRunId: string,
): Promise<{ steps: ActivitySteps }> {
  "use step";

  const resolved = await resolveActivityForGeneration(activities, "background");

  if (!resolved.shouldGenerate) {
    return { steps: resolved.existingSteps };
  }

  const { activity } = resolved;

  await streamStatus({ status: "started", step: "generateBackgroundContent" });
  await setActivityAsRunningStep({ activityId: activity.id, workflowRunId });

  const { data: result, error } = await safeAsync(() =>
    generateActivityBackground({
      chapterTitle: activity.lesson.chapter.title,
      courseTitle: activity.lesson.chapter.course.title,
      language: activity.language,
      lessonDescription: activity.lesson.description ?? "",
      lessonTitle: activity.lesson.title,
    }),
  );

  if (error || !result) {
    const reason = error ? "aiGenerationFailed" : "aiEmptyResult";
    await streamError({ reason, step: "generateBackgroundContent" });
    await handleActivityFailureStep({ activityId: activity.id });
    return { steps: [] };
  }

  const { error: saveError } = await saveContentSteps(activity.id, result.data.steps);

  if (saveError) {
    await streamError({ reason: "dbSaveFailed", step: "generateBackgroundContent" });
    await handleActivityFailureStep({ activityId: activity.id });
    return { steps: [] };
  }

  await streamStatus({ status: "completed", step: "generateBackgroundContent" });
  return { steps: result.data.steps };
}
