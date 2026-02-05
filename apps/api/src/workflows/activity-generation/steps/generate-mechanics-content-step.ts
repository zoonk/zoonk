import { generateActivityMechanics } from "@zoonk/ai/tasks/activities/core/mechanics";
import { safeAsync } from "@zoonk/utils/error";
import { streamStatus } from "../stream-status";
import { getExistingContentSteps, saveContentSteps } from "./_utils/content-step-helpers";
import { type ActivitySteps } from "./_utils/get-activity-steps";
import { type LessonActivity } from "./get-lesson-activities-step";
import { handleActivityFailureStep } from "./handle-failure-step";
import { setActivityAsRunningStep } from "./set-activity-as-running-step";

export async function generateMechanicsContentStep(
  activities: LessonActivity[],
  explanationSteps: ActivitySteps,
  workflowRunId: string,
): Promise<{ steps: ActivitySteps }> {
  "use step";

  const activity = activities.find((act) => act.kind === "mechanics");
  if (!activity) {
    return { steps: [] };
  }

  if (explanationSteps.length === 0) {
    await handleActivityFailureStep({ activityId: activity.id });
    return { steps: [] };
  }

  const existing = await getExistingContentSteps(activity.id);
  if (existing) {
    return { steps: existing };
  }

  await streamStatus({ status: "started", step: "generateMechanicsContent" });
  await setActivityAsRunningStep({ activityId: activity.id, workflowRunId });

  const { data: result, error } = await safeAsync(() =>
    generateActivityMechanics({
      chapterTitle: activity.lesson.chapter.title,
      courseTitle: activity.lesson.chapter.course.title,
      explanationSteps,
      language: activity.language,
      lessonDescription: activity.lesson.description ?? "",
      lessonTitle: activity.lesson.title,
    }),
  );

  if (error || !result) {
    await streamStatus({ status: "error", step: "generateMechanicsContent" });
    await handleActivityFailureStep({ activityId: activity.id });
    return { steps: [] };
  }

  const steps = await saveContentSteps(activity.id, result.data.steps, "generateMechanicsContent");

  return { steps };
}
