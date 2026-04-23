import { createEntityStepStream } from "@/workflows/_shared/stream-status";
import { type StepContentImagePreset } from "@zoonk/core/steps/content-image";
import { type StepImage } from "@zoonk/core/steps/contract/image";
import { type ActivityStepName } from "@zoonk/core/workflows/steps";
import { generateStepImages } from "./_utils/generate-step-images";
import { type LessonActivity } from "./get-lesson-activities-step";

/**
 * Several activity kinds now persist one uploaded image per learner-visible
 * step. This shared workflow step keeps the expensive image generation work in
 * one place so explanation and practice activities stream the same progress
 * events and use the same upload pipeline while still choosing the right
 * image-generation preset for each activity kind.
 */
function getImagePresetForActivity(activity: LessonActivity): StepContentImagePreset {
  if (activity.kind === "practice") {
    return "practice";
  }

  return "illustration";
}

export async function generateActivityStepImagesStep(
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
    preset: getImagePresetForActivity(activity),
    prompts,
  });

  await stream.status({ status: "completed", step: "generateStepImages" });

  return { images };
}
