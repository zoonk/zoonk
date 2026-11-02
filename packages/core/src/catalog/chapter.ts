import "server-only";
import { getCatalogChapterPlacement } from "./_utils/catalog-chapter";

/** Defaults to the home course; returns null when the course doesn't place the chapter or is inaccessible. */
export async function getCatalogChapter(input: { chapterId: string; courseId?: string }) {
  const found = await getCatalogChapterPlacement(input);

  if (!found) {
    return null;
  }

  const { chapter, course, level, position } = found;
  return { chapter, courseId: course.id, level, position };
}
