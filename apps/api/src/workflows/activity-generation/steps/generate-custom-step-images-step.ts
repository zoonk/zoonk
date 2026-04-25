import { createEntityStepStream } from "@/workflows/_shared/stream-status";
import { type StepImage } from "@zoonk/core/steps/contract/image";
import { type ActivityStepName } from "@zoonk/core/workflows/steps";
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
 * Generates uploaded step illustrations for one custom activity.
 * Pure data producer: no DB writes happen here.
 */
export async function generateCustomStepImagesStep(
  activity: LessonActivity,
  promptResult: CustomImagePromptResult,
): Promise<CustomStepImageResult> {
  "use step";

  await using stream = createEntityStepStream<ActivityStepName>(activity.id);

  await stream.status({ status: "started", step: "generateStepImages" });

  const result = await generateImagesForActivity(activity, promptResult);

  await stream.status({ status: "completed", step: "generateStepImages" });
  return result;
}
