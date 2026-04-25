import { createEntityStepStream } from "@/workflows/_shared/stream-status";
import { generateStepImagePrompts } from "@zoonk/ai/tasks/steps/image-prompts";
import { type ActivityStepName } from "@zoonk/core/workflows/steps";
import { type CustomContentResult } from "./generate-custom-content-step";
import { type LessonActivity } from "./get-lesson-activities-step";

export type CustomImagePromptResult = {
  activityId: string;
  prompts: string[];
};

/**
 * Generates image prompts for a single custom activity.
 * Pure data producer: no DB writes. Throws on failure.
 */
async function generatePromptsForActivity(
  activity: LessonActivity,
  contentResult: CustomContentResult,
): Promise<CustomImagePromptResult> {
  if (contentResult.steps.length === 0) {
    return { activityId: activity.id, prompts: [] };
  }

  const result = await generateStepImagePrompts({
    chapterTitle: activity.lesson.chapter.title,
    courseTitle: activity.lesson.chapter.course.title,
    language: activity.language,
    lessonDescription: activity.lesson.description ?? "",
    lessonTitle: activity.lesson.title,
    steps: contentResult.steps,
  });

  if (!result) {
    throw new Error("Empty step image prompt result for custom activity");
  }

  return { activityId: activity.id, prompts: result.data.prompts };
}

/**
 * Generates image prompts for one custom activity.
 * Pure data producer: no DB writes happen here.
 */
export async function generateCustomImagePromptsStep(
  activity: LessonActivity,
  contentResult: CustomContentResult,
): Promise<CustomImagePromptResult> {
  "use step";

  await using stream = createEntityStepStream<ActivityStepName>(activity.id);

  await stream.status({ status: "started", step: "generateImagePrompts" });

  const result = await generatePromptsForActivity(activity, contentResult);

  await stream.status({ status: "completed", step: "generateImagePrompts" });
  return result;
}
