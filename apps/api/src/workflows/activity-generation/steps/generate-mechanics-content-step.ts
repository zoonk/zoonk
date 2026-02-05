import { generateActivityMechanics } from "@zoonk/ai/tasks/activities/core/mechanics";
import { safeAsync } from "@zoonk/utils/error";
import { streamStatus } from "../stream-status";
import { type ActivitySteps, getActivitySteps } from "./_utils/get-activity-steps";
import { type LessonActivity } from "./get-lesson-activities-step";
import { handleActivityFailureStep } from "./handle-failure-step";
import { setActivityAsRunningStep } from "./set-activity-as-running-step";

export async function generateMechanicsContentStep(
  activities: LessonActivity[],
  explanationSteps: ActivitySteps,
  workflowRunId: string,
): Promise<{ steps: ActivitySteps }> {
  "use step";

  const activity = activities.find((a) => a.kind === "mechanics");

  if (!activity) {
    return { steps: [] };
  }

  if (activity.generationStatus === "completed" && activity._count.steps > 0) {
    return { steps: await getActivitySteps(activity.id) };
  }

  if (activity.generationStatus === "running") {
    return { steps: [] };
  }

  if (explanationSteps.length === 0) {
    return { steps: [] };
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

  if (error) {
    await streamStatus({ status: "error", step: "generateMechanicsContent" });
    await handleActivityFailureStep({ activityId: activity.id });
    throw error;
  }

  await streamStatus({ status: "completed", step: "generateMechanicsContent" });

  return { steps: result.data.steps };
}
