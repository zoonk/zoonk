import { generateActivityExplanation } from "@zoonk/ai/tasks/activities/core/explanation";
import { safeAsync } from "@zoonk/utils/error";
import { streamStatus } from "../stream-status";
import { type ActivitySteps, getActivitySteps } from "./_utils/get-activity-steps";
import { type LessonActivity } from "./get-lesson-activities-step";
import { handleActivityFailureStep } from "./handle-failure-step";
import { setActivityAsRunningStep } from "./set-activity-as-running-step";

export async function generateExplanationContentStep(
  activities: LessonActivity[],
  backgroundSteps: ActivitySteps,
  workflowRunId: string,
): Promise<{ steps: ActivitySteps }> {
  "use step";

  const activity = activities.find((a) => a.kind === "explanation");

  if (!activity) {
    return { steps: [] };
  }

  if (activity.generationStatus === "completed" && activity._count.steps > 0) {
    return { steps: await getActivitySteps(activity.id) };
  }

  if (activity.generationStatus === "running") {
    return { steps: [] };
  }

  if (backgroundSteps.length === 0) {
    return { steps: [] };
  }

  await streamStatus({ status: "started", step: "generateExplanationContent" });
  await setActivityAsRunningStep({ activityId: activity.id, workflowRunId });

  const { data: result, error } = await safeAsync(() =>
    generateActivityExplanation({
      backgroundSteps,
      chapterTitle: activity.lesson.chapter.title,
      courseTitle: activity.lesson.chapter.course.title,
      language: activity.language,
      lessonDescription: activity.lesson.description ?? "",
      lessonTitle: activity.lesson.title,
    }),
  );

  if (error) {
    await streamStatus({ status: "error", step: "generateExplanationContent" });
    await handleActivityFailureStep({ activityId: activity.id });
    throw error;
  }

  await streamStatus({ status: "completed", step: "generateExplanationContent" });

  return { steps: result.data.steps };
}
