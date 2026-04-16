import { createStepStream } from "@/workflows/_shared/stream-status";
import {
  type VisualDescription,
  generateStepVisualDescriptions,
} from "@zoonk/ai/tasks/steps/visual-descriptions";
import { type ActivityStepName } from "@zoonk/core/workflows/steps";
import { rejected, settledValues } from "@zoonk/utils/settled";
import { type CustomContentResult } from "./generate-custom-content-step";
import { type LessonActivity } from "./get-lesson-activities-step";

export type CustomVisualDescriptionResult = {
  activityId: string;
  descriptions: VisualDescription[];
};

/**
 * Generates visual descriptions for a single custom activity.
 * Pure data producer: no DB writes. Throws on failure.
 */
async function generateDescriptionsForActivity(
  activity: LessonActivity,
  contentResult: CustomContentResult,
): Promise<CustomVisualDescriptionResult> {
  const empty = { activityId: activity.id, descriptions: [] };

  if (contentResult.steps.length === 0) {
    return empty;
  }

  const result = await generateStepVisualDescriptions({
    chapterTitle: activity.lesson.chapter.title,
    courseTitle: activity.lesson.chapter.course.title,
    language: activity.language,
    lessonDescription: activity.lesson.description ?? "",
    lessonTitle: activity.lesson.title,
    steps: contentResult.steps,
  });

  if (!result) {
    throw new Error("Empty visual description result for custom activity");
  }

  return { activityId: activity.id, descriptions: result.data.descriptions };
}

/**
 * Generates visual descriptions for all custom activities in parallel.
 * This is stage 1 of the two-stage visual pipeline: it selects the
 * best visual kind for each step and writes a description for downstream
 * per-kind generation tasks.
 *
 * Pure data producer: no DB writes happen here.
 */
export async function generateCustomVisualDescriptionsStep(
  activities: LessonActivity[],
  customContentResults: CustomContentResult[],
): Promise<CustomVisualDescriptionResult[]> {
  "use step";

  if (customContentResults.length === 0) {
    return [];
  }

  await using stream = createStepStream<ActivityStepName>();

  await stream.status({ status: "started", step: "generateVisualDescriptions" });

  const allSettled = await Promise.allSettled(
    customContentResults.map((contentResult) => {
      const activity = activities.find((act) => act.id === contentResult.activityId);
      if (!activity) {
        return Promise.resolve({
          activityId: contentResult.activityId,
          descriptions: [],
        });
      }
      return generateDescriptionsForActivity(activity, contentResult);
    }),
  );

  await stream.status({
    status: rejected(allSettled) ? "error" : "completed",
    step: "generateVisualDescriptions",
  });

  return settledValues(allSettled);
}
