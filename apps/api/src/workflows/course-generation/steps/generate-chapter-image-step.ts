import { generateContentThumbnailImage } from "@zoonk/core/content/thumbnail";
import { type Chapter, prisma } from "@zoonk/db";
import { logError } from "@zoonk/utils/logger";

export type ChapterImageInput = Pick<Chapter, "description" | "id" | "imageUrl" | "title">;

/**
 * Saves a chapter thumbnail only when the chapter still has no image. The
 * guarded update avoids replacing an image another retry or workflow already
 * saved after this background workflow was enqueued.
 */
async function saveGeneratedChapterImage(input: {
  chapter: ChapterImageInput;
  imageUrl: string;
}): Promise<void> {
  await prisma.chapter.updateMany({
    data: { imageUrl: input.imageUrl },
    where: { id: input.chapter.id, imageUrl: null },
  });
}

/**
 * Generates and persists one chapter thumbnail as its own workflow step.
 * Existing images are skipped so retrying the background workflow preserves
 * artwork that was already created.
 */
export async function generateChapterImageStep(chapter: ChapterImageInput): Promise<void> {
  "use step";

  if (chapter.imageUrl) {
    return;
  }

  const { data: imageUrl, error } = await generateContentThumbnailImage({
    description: chapter.description,
    kind: "chapter",
    title: chapter.title,
  });

  if (error) {
    logError("[course-generation] Chapter image generation failed", {
      chapterId: chapter.id,
      error,
      title: chapter.title,
    });

    throw error;
  }

  if (!imageUrl) {
    const missingImageError = new Error("Chapter image generation returned no URL");

    logError("[course-generation] Chapter image generation failed", {
      chapterId: chapter.id,
      error: missingImageError,
      title: chapter.title,
    });

    throw missingImageError;
  }

  await saveGeneratedChapterImage({ chapter, imageUrl });
}
