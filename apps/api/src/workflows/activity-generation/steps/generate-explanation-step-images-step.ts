import { createEntityStepStream } from "@/workflows/_shared/stream-status";
import { type StepImage } from "@zoonk/core/steps/contract/image";
import { type ActivityStepName } from "@zoonk/core/workflows/steps";
import { generateStepImages } from "./_utils/generate-step-images";
import { type LessonActivity } from "./get-lesson-activities-step";

/**
 * Explanation activities create one uploaded illustration per readable step.
 * This workflow step keeps the per-entity stream around the expensive image
 * generation work.
 */
export async function generateExplanationStepImagesStep(
  activity: LessonActivity,
  prompts: string[],
): Promise<{ images: StepImage[] }> {
  "use step";

  await using stream = createEntityStepStream<ActivityStepName>(activity.id);
  await stream.status({ status: "started", step: "generateStepImages" });

  if (prompts.length === 0) {
    await stream.status({ status: "completed", step: "generateStepImages" });
    return { images: [] };
  }

  const images = await generateStepImages({
    language: activity.language,
    orgSlug: activity.lesson.chapter.course.organization?.slug,
    prompts,
  });

  await stream.status({ status: "completed", step: "generateStepImages" });

  return { images };
}
