import { generateActivityBackground } from "@zoonk/ai/tasks/activities/core/background";
import { safeAsync } from "@zoonk/utils/error";
import { streamStatus } from "../stream-status";
import { type ActivitySteps, getActivitySteps } from "./_utils/get-activity-steps";
import { type LessonActivity } from "./get-lesson-activities-step";
import { handleActivityFailureStep } from "./handle-failure-step";
import { setActivityAsRunningStep } from "./set-activity-as-running-step";

export async function generateBackgroundContentStep(
  activities: LessonActivity[],
  workflowRunId: string,
): Promise<{ steps: ActivitySteps }> {
  "use step";

  const activity = activities.find((a) => a.kind === "background");

  if (!activity) {
    return { steps: [] };
  }

  if (activity.generationStatus === "completed" && activity._count.steps > 0) {
    return { steps: await getActivitySteps(activity.id) };
  }

  if (activity.generationStatus === "running") {
    return { steps: [] };
  }

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

  if (error) {
    await streamStatus({ status: "error", step: "generateBackgroundContent" });
    await handleActivityFailureStep({ activityId: activity.id });
    throw error;
  }

  await streamStatus({ status: "completed", step: "generateBackgroundContent" });

  return { steps: result.data.steps };
}
