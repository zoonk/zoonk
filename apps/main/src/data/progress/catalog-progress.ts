import "server-only";
import { getChapterProgress } from "@zoonk/core/progress/get-chapter";
import { getCourseProgress } from "@zoonk/core/progress/get-course";
import { type LessonKind } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";

type CatalogProgressInput = { excludedLessonKinds?: LessonKind[] };

/**
 * Keeps optional chapter-card progress from blocking the catalog when a
 * transient read fails. Authentication and data selection remain in core.
 */
export async function getCatalogLessonProgress(
  input: CatalogProgressInput & { chapterId: string },
) {
  const { data } = await safeAsync(() => getChapterProgress(input));
  return data ?? [];
}

/**
 * Keeps optional course-card progress from blocking the catalog when a
 * transient read fails. Authentication and data selection remain in core.
 */
export async function getCatalogChapterProgress(
  input: CatalogProgressInput & { courseId: string },
) {
  const { data } = await safeAsync(() => getCourseProgress(input));
  return data ?? [];
}
