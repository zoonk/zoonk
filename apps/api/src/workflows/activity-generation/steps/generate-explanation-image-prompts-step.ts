import { createEntityStepStream } from "@/workflows/_shared/stream-status";
import { generateStepImagePrompts } from "@zoonk/ai/tasks/steps/image-prompts";
import { type ActivityStepName } from "@zoonk/core/workflows/steps";
import { type ActivitySteps } from "./_utils/get-activity-steps";
import { type LessonActivity } from "./get-lesson-activities-step";

/**
 * Explanation activities now generate one image prompt for each readable step,
 * including the closing anchor. Keeping prompt generation in its own workflow
 * step preserves progress streaming and lets the expensive image calls happen
 * afterward.
 */
export async function generateExplanationImagePromptsStep(
  activity: LessonActivity,
  steps: ActivitySteps,
): Promise<{ prompts: string[] }> {
  "use step";

  await using stream = createEntityStepStream<ActivityStepName>(activity.id);
  await stream.status({ status: "started", step: "generateImagePrompts" });

  if (steps.length === 0) {
    await stream.status({ status: "completed", step: "generateImagePrompts" });
    return { prompts: [] };
  }

  const result = await generateStepImagePrompts({
    chapterTitle: activity.lesson.chapter.title,
    courseTitle: activity.lesson.chapter.course.title,
    language: activity.language,
    lessonDescription: activity.lesson.description ?? "",
    lessonTitle: activity.lesson.title,
    steps,
  });

  if (!result) {
    throw new Error("Empty AI result for step image prompt generation");
  }

  await stream.status({ status: "completed", step: "generateImagePrompts" });

  return { prompts: result.data.prompts };
}
