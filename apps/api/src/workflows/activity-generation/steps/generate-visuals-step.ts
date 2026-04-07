import { createEntityStepStream } from "@/workflows/_shared/stream-status";
import {
  type VisualDescription,
  generateStepVisualDescriptions,
} from "@zoonk/ai/tasks/steps/visual-descriptions";
import { type ActivityStepName } from "@zoonk/core/workflows/steps";
import { type ActivitySteps } from "./_utils/get-activity-steps";
import { type LessonActivity } from "./get-lesson-activities-step";

/**
 * Generates visual descriptions (kind + description) for an explanation activity's steps.
 * This is stage 1 of the two-stage visual pipeline: it selects the best visual kind
 * for each step and writes a description specific enough for the per-kind generation
 * tasks to produce the actual visual content.
 *
 * Returns the descriptions array. No DB writes happen here.
 */
export async function generateVisualDescriptionsForActivityStep(
  activity: LessonActivity,
  steps: ActivitySteps,
): Promise<{ descriptions: VisualDescription[] }> {
  "use step";

  await using stream = createEntityStepStream<ActivityStepName>(activity.id);

  if (steps.length === 0) {
    await stream.status({ status: "started", step: "generateVisualDescriptions" });
    await stream.status({ status: "completed", step: "generateVisualDescriptions" });
    return { descriptions: [] };
  }

  await stream.status({ status: "started", step: "generateVisualDescriptions" });

  const result = await generateStepVisualDescriptions({
    chapterTitle: activity.lesson.chapter.title,
    courseTitle: activity.lesson.chapter.course.title,
    language: activity.language,
    lessonDescription: activity.lesson.description ?? "",
    lessonTitle: activity.lesson.title,
    steps,
  });

  if (!result) {
    throw new Error("Empty AI result for visual description generation");
  }

  await stream.status({ status: "completed", step: "generateVisualDescriptions" });

  return { descriptions: result.data.descriptions };
}
