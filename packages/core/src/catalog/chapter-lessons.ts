import "server-only";
import { getCatalogChapterPlacement } from "./_utils/catalog-chapter";

/**
 * Lists a chapter's visible lessons in order, read in a catalog course (the given one or the
 * chapter's home course), each with its 0-based position and its content generation state.
 */
export async function listCatalogChapterLessons(input: { chapterId: string; courseId?: string }) {
  const found = await getCatalogChapterPlacement(input);

  if (!found) {
    return null;
  }

  return {
    chapterId: found.chapter.id,
    courseId: found.course.id,
    lessons: found.chapter.lessons.map((lesson, position) => ({ ...lesson, position })),
  };
}
