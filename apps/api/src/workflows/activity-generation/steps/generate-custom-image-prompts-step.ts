import { createStepStream } from "@/workflows/_shared/stream-status";
import { generateStepImagePrompts } from "@zoonk/ai/tasks/steps/image-prompts";
import { type ActivityStepName } from "@zoonk/core/workflows/steps";
import { rejected, settledValues } from "@zoonk/utils/settled";
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
 * Generates image prompts for all custom activities in parallel.
 * Pure data producer: no DB writes happen here.
 */
export async function generateCustomImagePromptsStep(
  activities: LessonActivity[],
  customContentResults: CustomContentResult[],
): Promise<CustomImagePromptResult[]> {
  "use step";

  if (customContentResults.length === 0) {
    return [];
  }

  await using stream = createStepStream<ActivityStepName>();

  await stream.status({ status: "started", step: "generateImagePrompts" });

  const allSettled = await Promise.allSettled(
    customContentResults.map((contentResult) => {
      const activity = activities.find((act) => act.id === contentResult.activityId);

      if (!activity) {
        return Promise.resolve({
          activityId: contentResult.activityId,
          prompts: [],
        });
      }

      return generatePromptsForActivity(activity, contentResult);
    }),
  );

  await stream.status({
    status: rejected(allSettled) ? "error" : "completed",
    step: "generateImagePrompts",
  });

  return settledValues(allSettled);
}
