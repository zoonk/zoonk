import { createStepStream } from "@/workflows/_shared/stream-status";
import { type StepContentImagePreset } from "@zoonk/ai/tasks/steps/content-image";
import { type StepImage } from "@zoonk/core/steps/contract/image";
import { type LessonStepName } from "@zoonk/core/workflows/steps";
import { generateStepImages } from "./_utils/generate-step-images";
import { type LessonContext } from "./get-lesson-step";

export async function generateStepImagesStep({
  context,
  preset = "illustration",
  prompts,
}: {
  context: LessonContext;
  preset?: StepContentImagePreset;
  prompts: string[];
}): Promise<{ images: StepImage[] }> {
  "use step";

  await using stream = createStepStream<LessonStepName>();
  await stream.status({ status: "started", step: "generateStepImages" });

  if (prompts.length === 0) {
    await stream.status({ status: "completed", step: "generateStepImages" });
    return { images: [] };
  }

  const images = await generateStepImages({
    language: context.language,
    orgSlug: context.chapter.course.organization?.slug,
    preset,
    prompts,
  });

  await stream.status({ status: "completed", step: "generateStepImages" });

  return { images };
}
