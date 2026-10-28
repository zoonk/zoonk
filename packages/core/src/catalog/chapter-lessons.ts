import "server-only";
import { getCatalogChapterPlacement } from "./_utils/catalog-chapter";

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
