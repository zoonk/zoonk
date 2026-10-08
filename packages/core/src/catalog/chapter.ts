import "server-only";
import { getCatalogChapterPlacement } from "./_utils/catalog-chapter";

/**
 * Reads a chapter in a catalog course: the given course, or the chapter's home course by
 * default. Returns the chapter with the course id, the level band the course places it in and its
 * position across that course's outline. Null when the course doesn't place the chapter, or when
 * the chapter is private to someone else.
 */
export async function getCatalogChapter(input: { chapterId: string; courseId?: string }) {
  const found = await getCatalogChapterPlacement(input);

  if (!found) {
    return null;
  }

  const { chapter, course, level, position } = found;
  return { chapter, courseId: course.id, level, position };
}
