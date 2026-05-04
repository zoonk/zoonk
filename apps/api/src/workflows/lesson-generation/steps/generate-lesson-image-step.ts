import { createStepStream } from "@/workflows/_shared/stream-status";
import { generateContentThumbnailImage } from "@zoonk/core/content/thumbnail";
import { type LessonStepName } from "@zoonk/core/workflows/steps";
import { type LessonContext } from "./get-lesson-step";

/**
 * Generates thumbnails only for lesson kinds that should have standalone
 * catalog artwork. Other generated lesson kinds intentionally keep `imageUrl`
 * null, and this step returns before streaming so their generation UI does not
 * show a thumbnail phase.
 */
export async function generateLessonImageStep(context: LessonContext): Promise<string | null> {
  "use step";

  if (context.kind !== "explanation" && context.kind !== "tutorial") {
    return null;
  }

  await using stream = createStepStream<LessonStepName>();
  await stream.status({ status: "started", step: "generateLessonImage" });

  if (context.imageUrl) {
    await stream.status({ status: "completed", step: "generateLessonImage" });
    return context.imageUrl;
  }

  if (!context.title) {
    throw new Error("Lesson image generation requires a lesson title");
  }

  const { data: generatedImageUrl, error } = await generateContentThumbnailImage({
    description: context.description,
    kind: "lesson",
    title: context.title,
  });

  if (error) {
    throw error;
  }

  if (!generatedImageUrl) {
    throw new Error("Lesson image generation returned no URL");
  }

  await stream.status({ status: "completed", step: "generateLessonImage" });

  return generatedImageUrl;
}
