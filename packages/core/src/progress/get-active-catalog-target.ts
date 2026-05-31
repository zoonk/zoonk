import { type LessonScope } from "../lessons/find-last-completed";
import { getContinueLessonTarget } from "./get-continue-lesson-target";

export type ActiveCatalogTarget = { chapterSlug: string; lessonSlug?: string };

/**
 * The active catalog shortcut follows the same completed-progress continuation
 * target as start/continue links, but stays hidden until the learner has
 * actually completed something in the requested scope.
 */
export async function getActiveCatalogTarget({
  headers,
  scope,
}: {
  headers?: Headers;
  scope: LessonScope;
}): Promise<ActiveCatalogTarget | null> {
  const target = await getContinueLessonTarget({ headers, scope });

  if (!target?.hasStarted) {
    return null;
  }

  if ("lessonSlug" in target) {
    return { chapterSlug: target.chapterSlug, lessonSlug: target.lessonSlug };
  }

  return { chapterSlug: target.chapterSlug };
}
