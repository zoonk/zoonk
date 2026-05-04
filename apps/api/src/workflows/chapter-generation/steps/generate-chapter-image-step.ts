import { createStepStream } from "@/workflows/_shared/stream-status";
import { generateContentThumbnailImage } from "@zoonk/core/content/thumbnail";
import { type ChapterStepName } from "@zoonk/core/workflows/steps";
import { type ChapterContext } from "./get-chapter-step";

/**
 * Generates the chapter thumbnail during chapter generation, after the lesson
 * plan exists but before the chapter is marked completed. Returning the URL
 * lets the completion step save the image and status together for the normal
 * successful path.
 */
export async function generateChapterImageStep(context: ChapterContext): Promise<string | null> {
  "use step";

  await using stream = createStepStream<ChapterStepName>();
  await stream.status({ status: "started", step: "generateChapterImage" });

  if (context.imageUrl) {
    await stream.status({ status: "completed", step: "generateChapterImage" });
    return context.imageUrl;
  }

  const { data: generatedImageUrl, error } = await generateContentThumbnailImage({
    description: context.description,
    kind: "chapter",
    title: context.title,
  });

  if (error) {
    throw error;
  }

  if (!generatedImageUrl) {
    throw new Error("Chapter image generation returned no URL");
  }

  await stream.status({ status: "completed", step: "generateChapterImage" });

  return generatedImageUrl;
}
