import { createStepStream } from "@/workflows/_shared/stream-status";
import { type StepContentImagePreset } from "@zoonk/ai/tasks/steps/content-image";
import { type StepImage } from "@zoonk/core/steps/contract/image";
import { type LessonStepName } from "@zoonk/core/workflows/steps";
import { generateStepImages } from "./_utils/generate-step-images";
import { type LessonContext } from "./get-lesson-step";

async function generateSingleStepImage({
  context,
  preset,
  prompt,
}: {
  context: LessonContext;
  preset: StepContentImagePreset;
  prompt: string;
}): Promise<StepImage> {
  "use step";
  await using stream = createStepStream<LessonStepName>();
  await stream.status({ status: "started", step: "generateStepImages" });

  const [image] = await generateStepImages({
    language: context.language,
    orgSlug: context.chapter.course.organization?.slug,
    preset,
    prompts: [prompt],
  });

  if (!image) {
    throw new Error("Step image generation returned no image");
  }

  await stream.status({ status: "completed", step: "generateStepImages" });
  return image;
}

/** Each paid image is a durable step; empty positions preserve exact text/image alignment. */
export async function generateStepImagesStep({
  context,
  preset = "illustration",
  prompts,
}: {
  context: LessonContext;
  preset?: StepContentImagePreset;
  prompts: string[];
}): Promise<{ images: (StepImage | null)[] }> {
  const images = await Promise.all(
    prompts.map((prompt) =>
      prompt.trim() ? generateSingleStepImage({ context, preset, prompt }) : Promise.resolve(null),
    ),
  );

  return { images };
}
