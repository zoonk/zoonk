import "server-only";
import { cacheTag } from "next/cache";
import { getLibraryLessonCacheTag } from "../../cache/tags";
import { toIdKey } from "../../library/_utils/shared-rows";
import {
  type LessonGenerationState,
  getLessonGenerationStates,
} from "../../library/generation/lesson-generation-state";

async function readStateEntries(lessonIds: string[]): Promise<[string, LessonGenerationState][]> {
  "use cache: private";

  cacheTag(...lessonIds.map((lessonId) => getLibraryLessonCacheTag(lessonId)));

  return [...(await getLessonGenerationStates(lessonIds))];
}

/** GET-only: where each lesson stands, read once per request however many readers screen its blocks. */
export async function readLessonStates(
  lessonIds: Iterable<string>,
): Promise<Map<string, LessonGenerationState>> {
  const ids = toIdKey(lessonIds);
  return ids.length === 0 ? new Map() : new Map(await readStateEntries(ids));
}
