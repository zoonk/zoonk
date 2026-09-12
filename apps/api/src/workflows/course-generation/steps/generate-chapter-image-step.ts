import { getCourseCurriculumCacheTag } from "@zoonk/core/cache-tags";
import { generateContentThumbnailImage } from "@zoonk/core/content/thumbnail";
import {
  type CourseRevisionContext,
  withCurrentCourseRevision,
} from "@zoonk/core/workflows/internal/course-curriculum";
import { type Chapter, prisma } from "@zoonk/db";
import { logError } from "@zoonk/utils/logger";
import { revalidateTag } from "next/cache";

export type ChapterImageInput = Pick<Chapter, "description" | "id" | "imageUrl" | "title">;

/**
 * Saves a chapter thumbnail only when the chapter still has no image. The
 * guarded update avoids replacing an image another retry or workflow already
 * saved after this background workflow was enqueued.
 */
async function saveGeneratedChapterImage(input: {
  chapter: ChapterImageInput;
  imageUrl: string;
  revisionContext: CourseRevisionContext;
}): Promise<void> {
  const result = await withCurrentCourseRevision({
    context: input.revisionContext,
    operation: (transaction) =>
      transaction.chapter.updateMany({
        data: { imageUrl: input.imageUrl },
        where: { id: input.chapter.id, imageUrl: null },
      }),
  });

  if (result.status === "applied") {
    revalidateTag(getCourseCurriculumCacheTag(input.revisionContext.courseId), { expire: 0 });
  }
}

/**
 * Generates and persists one chapter thumbnail as its own workflow step.
 * Existing images are skipped so retrying the background workflow preserves
 * artwork that was already created.
 */
export async function generateChapterImageStep(chapter: ChapterImageInput): Promise<void> {
  "use step";

  const currentChapter = await prisma.chapter.findUnique({
    include: { course: true },
    where: { id: chapter.id },
  });

  if (!currentChapter || currentChapter.imageUrl) {
    return;
  }

  const { data: imageUrl, error } = await generateContentThumbnailImage({
    description: currentChapter.description,
    kind: "chapter",
    title: currentChapter.title,
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

  await saveGeneratedChapterImage({
    chapter: currentChapter,
    imageUrl,
    revisionContext: {
      contentRevision: currentChapter.course.contentRevision,
      courseId: currentChapter.courseId,
    },
  });
}
