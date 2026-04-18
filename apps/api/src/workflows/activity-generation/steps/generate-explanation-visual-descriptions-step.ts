import { createEntityStepStream } from "@/workflows/_shared/stream-status";
import {
  type VisualDescription,
  generateStepVisualDescriptions,
} from "@zoonk/ai/tasks/steps/visual-descriptions";
import { type ActivityStepName } from "@zoonk/core/workflows/steps";
import { type ActivitySteps } from "./_utils/get-activity-steps";
import { type LessonActivity } from "./get-lesson-activities-step";

/**
 * Explanation activities still use the shared visual-description task so the
 * visual-planning logic stays consistent with custom activities. We only pass
 * the explanation prose steps here because predict checks and the closing
 * anchor do not need visuals.
 */
export async function generateExplanationVisualDescriptionsStep(
  activity: LessonActivity,
  steps: ActivitySteps,
): Promise<{ descriptions: VisualDescription[] }> {
  "use step";

  await using stream = createEntityStepStream<ActivityStepName>(activity.id);
  await stream.status({ status: "started", step: "generateVisualDescriptions" });

  if (steps.length === 0) {
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
