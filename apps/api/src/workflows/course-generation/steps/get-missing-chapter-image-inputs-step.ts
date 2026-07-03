import { prisma } from "@zoonk/db";
import { type ChapterImageInput } from "./generate-chapter-image-step";

/**
 * Loads the current chapter rows that still need thumbnails right before the
 * background image workflow runs. This keeps image generation tied to the
 * database state after setup instead of depending on whichever chapter list the
 * parent workflow needed for lesson generation.
 */
export async function getMissingChapterImageInputsStep(
  courseId: string,
): Promise<ChapterImageInput[]> {
  "use step";

  return prisma.chapter.findMany({
    orderBy: { position: "asc" },
    where: { courseId, imageUrl: null },
  });
}
