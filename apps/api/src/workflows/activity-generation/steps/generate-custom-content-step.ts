import { createEntityStepStream } from "@/workflows/_shared/stream-status";
import { generateActivityCustom } from "@zoonk/ai/tasks/activities/custom";
import { type ActivityStepName } from "@zoonk/core/workflows/steps";
import { type ActivitySteps } from "./_utils/get-activity-steps";
import { type LessonActivity } from "./get-lesson-activities-step";

export type CustomContentResult = { activityId: string; steps: ActivitySteps };

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
 * No status checks — the caller only passes activities that need generation.
 * Returns data only — no DB writes.
 */
async function generateForActivity(activity: LessonActivity): Promise<CustomContentResult> {
  const steps = await generateContent(activity);
  return { activityId: activity.id, steps };
}

/**
 * Generates custom content for one custom activity.
 * Returns the raw content data without saving to the database.
 *
 * The caller fans out per activity at the workflow level so one failed custom
 * activity can be retried and marked failed without affecting its siblings.
 */
export async function generateCustomContentStep(
  activity: LessonActivity,
): Promise<CustomContentResult> {
  "use step";

  await using stream = createEntityStepStream<ActivityStepName>(activity.id);

  await stream.status({ status: "started", step: "generateCustomContent" });

  const result = await generateForActivity(activity);

  await stream.status({ status: "completed", step: "generateCustomContent" });
  return result;
}
