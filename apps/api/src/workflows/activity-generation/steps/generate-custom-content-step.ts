import { createStepStream } from "@/workflows/_shared/stream-status";
import { type ActivityStepName } from "@/workflows/config";
import { generateActivityCustom } from "@zoonk/ai/tasks/activities/custom";
import { rejected, settledValues } from "@zoonk/utils/settled";
import { resolveActivityForGeneration } from "./_utils/content-step-helpers";
import { type ActivitySteps } from "./_utils/get-activity-steps";
import { type LessonActivity } from "./get-lesson-activities-step";

export type CustomContentResult = { activityId: number; steps: ActivitySteps };

/**
 * Calls AI to generate custom activity content.
 * Pure data producer: no DB writes. Throws on failure
 * to let the workflow framework retry.
 */
async function generateContent(activity: LessonActivity): Promise<ActivitySteps> {
  const result = await generateActivityCustom({
    activityDescription: activity.description ?? "",
    activityTitle: activity.title ?? "",
    chapterTitle: activity.lesson.chapter.title,
    courseTitle: activity.lesson.chapter.course.title,
    language: activity.language,
    lessonDescription: activity.lesson.description ?? "",
    lessonTitle: activity.lesson.title,
  });

  const steps: ActivitySteps = result?.data?.steps ?? [];

  if (steps.length === 0) {
    throw new Error("Empty AI result for custom content");
  }

  return steps;
}

/**
 * Generates content for a single custom activity.
 * Checks if generation is needed, then calls AI.
 * Returns data only — no DB writes.
 */
async function generateForActivity(activity: LessonActivity): Promise<CustomContentResult> {
  const resolved = await resolveActivityForGeneration(activity);

  if (!resolved.shouldGenerate) {
    return { activityId: activity.id, steps: resolved.existingSteps };
  }

  const steps = await generateContent(activity);
  return { activityId: activity.id, steps };
}

/**
 * Generates custom content for all custom activities in parallel.
 * Returns the raw content data without saving to the database.
 * Each activity's content will be persisted later by `saveCustomActivityStep`.
 */
export async function generateCustomContentStep(
  activities: LessonActivity[],
): Promise<CustomContentResult[]> {
  "use step";

  const customActivities = activities.filter((act) => act.kind === "custom");

  if (customActivities.length === 0) {
    return [];
  }

  await using stream = createStepStream<ActivityStepName>();

  await stream.status({ status: "started", step: "generateCustomContent" });

  const allSettled = await Promise.allSettled(
    customActivities.map((act) => generateForActivity(act)),
  );

  await stream.status({
    status: rejected(allSettled) ? "error" : "completed",
    step: "generateCustomContent",
  });

  return settledValues(allSettled);
}
