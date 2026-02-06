import { generateActivityExamples } from "@zoonk/ai/tasks/activities/core/examples";
import { safeAsync } from "@zoonk/utils/error";
import { streamStatus } from "../stream-status";
import { resolveActivityForGeneration, saveContentSteps } from "./_utils/content-step-helpers";
import { type ActivitySteps } from "./_utils/get-activity-steps";
import { type LessonActivity } from "./get-lesson-activities-step";
import { handleActivityFailureStep } from "./handle-failure-step";
import { setActivityAsRunningStep } from "./set-activity-as-running-step";

export async function generateExamplesContentStep(
  activities: LessonActivity[],
  explanationSteps: ActivitySteps,
  workflowRunId: string,
): Promise<{ steps: ActivitySteps }> {
  "use step";

  const resolved = await resolveActivityForGeneration(activities, "examples");

  if (!resolved.shouldGenerate) {
    return { steps: resolved.existingSteps };
  }

  const { activity } = resolved;

  if (explanationSteps.length === 0) {
    await handleActivityFailureStep({ activityId: activity.id });
    return { steps: [] };
  }

  await streamStatus({ status: "started", step: "generateExamplesContent" });
  await setActivityAsRunningStep({ activityId: activity.id, workflowRunId });

  const { data: result, error } = await safeAsync(() =>
    generateActivityExamples({
      chapterTitle: activity.lesson.chapter.title,
      courseTitle: activity.lesson.chapter.course.title,
      explanationSteps,
      language: activity.language,
      lessonDescription: activity.lesson.description ?? "",
      lessonTitle: activity.lesson.title,
    }),
  );

  if (error || !result) {
    await streamStatus({ status: "error", step: "generateExamplesContent" });
    await handleActivityFailureStep({ activityId: activity.id });
    return { steps: [] };
  }

  return saveAndStreamResult(activity.id, result.data.steps);
}

async function saveAndStreamResult(
  activityId: bigint | number,
  steps: ActivitySteps,
): Promise<{ steps: ActivitySteps }> {
  const { error } = await saveContentSteps(activityId, steps);

  if (error) {
    await streamStatus({ status: "error", step: "generateExamplesContent" });
    await handleActivityFailureStep({ activityId });
    return { steps: [] };
  }

  await streamStatus({ status: "completed", step: "generateExamplesContent" });
  return { steps };
}
