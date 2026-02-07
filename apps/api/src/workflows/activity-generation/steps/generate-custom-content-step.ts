import { generateActivityCustom } from "@zoonk/ai/tasks/activities/custom";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { streamStatus } from "../stream-status";
import { saveContentSteps } from "./_utils/content-step-helpers";
import { type ActivitySteps, parseActivitySteps } from "./_utils/get-activity-steps";
import { type LessonActivity } from "./get-lesson-activities-step";
import { handleActivityFailureStep } from "./handle-failure-step";
import { setActivityAsRunningStep } from "./set-activity-as-running-step";

export type CustomContentResult = { activityId: number; steps: ActivitySteps };

async function getExistingSteps(activityId: number): Promise<ActivitySteps | null> {
  const { data: existingSteps } = await safeAsync(() =>
    prisma.step.findMany({
      orderBy: { position: "asc" },
      select: { content: true },
      where: { activityId },
    }),
  );

  if (existingSteps && existingSteps.length > 0) {
    return parseActivitySteps(existingSteps);
  }

  return null;
}

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
  const empty: CustomContentResult = { activityId: activity.id, steps: [] };

  if (activity.generationStatus === "completed") {
    const existing = await getExistingSteps(activity.id);
    return { activityId: activity.id, steps: existing ?? [] };
  }

  if (activity.generationStatus === "running") {
    return empty;
  }

  if (activity.generationStatus === "failed") {
    await prisma.step.deleteMany({ where: { activityId: activity.id } });
  }

  await setActivityAsRunningStep({ activityId: activity.id, workflowRunId });

  const steps = await generateAndSaveContent(activity);

  if (steps.length === 0) {
    await handleActivityFailureStep({ activityId: activity.id });
    return empty;
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

  await streamStatus({ status: "started", step: "generateCustomContent" });

  const results = await Promise.allSettled(
    customActivities.map((act) => generateForActivity(act, workflowRunId)),
  );

  const settled = results.map((result) =>
    result.status === "fulfilled" ? result.value : { activityId: 0, steps: [] as ActivitySteps },
  );

  await streamStatus({ status: "completed", step: "generateCustomContent" });

  return settled.filter((result) => result.activityId !== 0);
}
