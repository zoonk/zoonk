import { createStepStream } from "@/workflows/_shared/stream-status";
import { type ActivityStepName } from "@/workflows/config";
import { generateActivityCustom } from "@zoonk/ai/tasks/activities/custom";
import { safeAsync } from "@zoonk/utils/error";
import { rejected, settledValues } from "@zoonk/utils/settled";
import { resolveActivityForGeneration, saveContentSteps } from "./_utils/content-step-helpers";
import { type ActivitySteps } from "./_utils/get-activity-steps";
import { type LessonActivity } from "./get-lesson-activities-step";
import { handleActivityFailureStep } from "./handle-failure-step";
import { setActivityAsRunningStep } from "./set-activity-as-running-step";

export type CustomContentResult = { activityId: number; steps: ActivitySteps };

async function generateAndSaveContent(activity: LessonActivity): Promise<ActivitySteps> {
  const { data: result, error } = await safeAsync(() =>
    generateActivityCustom({
      activityDescription: activity.description ?? "",
      activityTitle: activity.title ?? "",
      chapterTitle: activity.lesson.chapter.title,
      courseTitle: activity.lesson.chapter.course.title,
      language: activity.language,
      lessonDescription: activity.lesson.description ?? "",
      lessonTitle: activity.lesson.title,
    }),
  );

  const steps: ActivitySteps = (!error && result?.data?.steps) || [];

  if (steps.length === 0) {
    return [];
  }

  const { error: saveError } = await saveContentSteps(activity.id, steps);
  return saveError ? [] : steps;
}

async function generateForActivity(
  activity: LessonActivity,
  workflowRunId: string,
): Promise<CustomContentResult> {
  const resolved = await resolveActivityForGeneration(activity);

  if (!resolved.shouldGenerate) {
    return { activityId: activity.id, steps: resolved.existingSteps };
  }

  await setActivityAsRunningStep({ activityId: activity.id, workflowRunId });

  const steps = await generateAndSaveContent(activity);

  if (steps.length === 0) {
    await handleActivityFailureStep({ activityId: activity.id });
    throw new Error("Content generation failed");
  }

  return { activityId: activity.id, steps };
}

export async function generateCustomContentStep(
  activities: LessonActivity[],
  workflowRunId: string,
): Promise<CustomContentResult[]> {
  "use step";

  const customActivities = activities.filter((act) => act.kind === "custom");

  if (customActivities.length === 0) {
    return [];
  }

  await using stream = createStepStream<ActivityStepName>();

  await stream.status({ status: "started", step: "generateCustomContent" });

  const allSettled = await Promise.allSettled(
    customActivities.map((act) => generateForActivity(act, workflowRunId)),
  );

  await stream.status({
    status: rejected(allSettled) ? "error" : "completed",
    step: "generateCustomContent",
  });

  return settledValues(allSettled);
}
