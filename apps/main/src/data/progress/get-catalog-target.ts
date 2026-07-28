import "server-only";
import { type LessonScope } from "@zoonk/core/lessons/scope";
import {
  type ActiveLessonTarget,
  getActiveLessonTarget,
  getNextLesson,
} from "@zoonk/core/progress/get-next-lesson";
import { type LessonKind } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";

type CatalogTargetInput = { excludedLessonKinds?: LessonKind[]; scope: LessonScope };

/**
 * Keeps optional continuation failures out of the catalog while core resolves
 * the trusted session and next resource.
 */
export async function getContinueLessonTarget(input: CatalogTargetInput) {
  const { data } = await safeAsync(() => getNextLesson(input));
  return data ?? null;
}

/**
 * Keeps optional active-target failures out of catalog lists while core owns
 * their authenticated selection.
 */
export async function getActiveCatalogTarget(
  input: CatalogTargetInput,
): Promise<ActiveLessonTarget | null> {
  const { data } = await safeAsync(() => getActiveLessonTarget(input));
  return data ?? null;
}
