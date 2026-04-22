import { createStepStream } from "@/workflows/_shared/stream-status";
import { type StepImage } from "@zoonk/core/steps/contract/image";
import { type ActivityStepName } from "@zoonk/core/workflows/steps";
import { rejected, settledValues } from "@zoonk/utils/settled";
import { generateStepImages } from "./_utils/generate-step-images";
import { type CustomImagePromptResult } from "./generate-custom-image-prompts-step";
import { type LessonActivity } from "./get-lesson-activities-step";

type CustomStepImageResult = {
  activityId: string;
  images: StepImage[];
};

/**
 * Generates uploaded step illustrations for a single custom activity.
 * Pure data producer: no DB writes. Throws on failure.
 */
async function generateImagesForActivity(
  activity: LessonActivity,
  promptResult: CustomImagePromptResult,
): Promise<CustomStepImageResult> {
  if (promptResult.prompts.length === 0) {
    return { activityId: activity.id, images: [] };
  }

  const images = await generateStepImages({
    language: activity.language,
    orgSlug: activity.lesson.chapter.course.organization?.slug,
    prompts: promptResult.prompts,
  });

  return { activityId: activity.id, images };
}

/**
 * Generates uploaded step illustrations for all custom activities in parallel.
 * Pure data producer: no DB writes happen here.
 */
export async function generateCustomStepImagesStep(
  activities: LessonActivity[],
  promptResults: CustomImagePromptResult[],
): Promise<CustomStepImageResult[]> {
  "use step";

  if (promptResults.length === 0) {
    return [];
  }

  await using stream = createStepStream<ActivityStepName>();

  await stream.status({ status: "started", step: "generateStepImages" });

  const allSettled = await Promise.allSettled(
    promptResults.map((promptResult) => {
      const activity = activities.find((act) => act.id === promptResult.activityId);

      if (!activity) {
        return Promise.resolve({
          activityId: promptResult.activityId,
          images: [],
        });
      }

      return generateImagesForActivity(activity, promptResult);
    }),
  );

  await stream.status({
    status: rejected(allSettled) ? "error" : "completed",
    step: "generateStepImages",
  });

  return settledValues(allSettled);
}
