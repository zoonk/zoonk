import "server-only";
import { getSession } from "@/data/users/get-session";
import { getChapterProgress } from "@zoonk/core/progress/chapters";
import { getLessonProgress } from "@zoonk/core/progress/lessons";
import { type LessonKind } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import {
  listDurableChapterCompletionIds,
  listPublishedCourseChapters,
  listPublishedLessonProgressRows,
} from "./progress-queries";

type CatalogProgressInput = { excludedLessonKinds?: LessonKind[] };

/**
 * Builds lesson progress from independently cached query leaves. The public
 * wrapper never accepts a user id, so only the trusted session can select
 * personalized rows stored by the application cache.
 */
async function loadCatalogLessonProgress({
  chapterId,
  excludedLessonKinds = [],
}: CatalogProgressInput & { chapterId: string }) {
  const session = await getSession();

  if (!session) {
    return [];
  }

  const scope = { chapterId } as const;
  const rows = await listPublishedLessonProgressRows({ excludedLessonKinds, scope });

  return getLessonProgress({ rows });
}

/**
 * Optional lesson progress degrades to an empty list outside the cached query
 * leaves, allowing the next request to retry a transient database failure.
 */
export async function getCatalogLessonProgress(
  input: CatalogProgressInput & { chapterId: string },
) {
  const { data } = await safeAsync(() => loadCatalogLessonProgress(input));
  return data ?? [];
}

/**
 * Builds chapter progress from one parallel wave of canonical app queries.
 * Curriculum and learner updates invalidate those leaves independently.
 */
async function loadCatalogChapterProgress({
  courseId,
  excludedLessonKinds = [],
}: CatalogProgressInput & { courseId: string }) {
  const session = await getSession();

  if (!session) {
    return [];
  }

  const scope = { courseId } as const;

  const [chapters, durableChapterCompletionIds, rows] = await Promise.all([
    listPublishedCourseChapters({ courseId }),
    listDurableChapterCompletionIds({ excludedLessonKinds, scope }),
    listPublishedLessonProgressRows({ excludedLessonKinds, scope }),
  ]);

  return getChapterProgress({ chapters, durableChapterCompletionIds, rows });
}

/**
 * Optional chapter progress degrades to an empty list outside the cached query
 * leaves, allowing the next request to retry a transient database failure.
 */
export async function getCatalogChapterProgress(
  input: CatalogProgressInput & { courseId: string },
) {
  const { data } = await safeAsync(() => loadCatalogChapterProgress(input));
  return data ?? [];
}
