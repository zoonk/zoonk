import "server-only";
import { type LessonScope } from "@zoonk/core/lessons/scope";
import {
  type ActiveCatalogTarget,
  getContinueLessonTarget as selectContinueLessonTarget,
  toActiveCatalogTarget,
} from "@zoonk/core/progress/continue-lesson-target";
import {
  getLastCompletedLessonAnchor,
  getNextLessonState,
} from "@zoonk/core/progress/next-lesson-state";
import { type PublishedCourseChapter } from "@zoonk/core/progress/queries";
import { type LessonKind } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import {
  hasDurableCourseCompletion,
  listDurableChapterCompletionIds,
  listPublishedCourseChapters,
  listPublishedLessonProgressRows,
} from "./progress-queries";

type CatalogTargetInput = { excludedLessonKinds?: LessonKind[]; scope: LessonScope };

/**
 * Only course continuation can fall through to an empty later chapter. Loading
 * that outline in the same query wave keeps this distinction out of the pure
 * core selector without adding work to chapter and lesson scopes.
 */
function listTargetChapters({ scope }: { scope: LessonScope }): Promise<PublishedCourseChapter[]> {
  if (!("courseId" in scope)) {
    return Promise.resolve([]);
  }

  return listPublishedCourseChapters({ courseId: scope.courseId });
}

/**
 * A durable course badge only participates in course-scope continuation. Other
 * scopes can resolve false immediately while their independent reads continue
 * in the same Promise.all wave.
 */
function getTargetCourseCompletion({ scope }: { scope: LessonScope }) {
  if (!("courseId" in scope)) {
    return Promise.resolve(false);
  }

  return hasDurableCourseCompletion({ courseId: scope.courseId });
}

/**
 * Resolves a current-user continuation target from parallel cached leaves and
 * pure core selectors. The query wrappers remain responsible for identity.
 */
async function loadContinueLessonTarget({ excludedLessonKinds = [], scope }: CatalogTargetInput) {
  const chaptersPromise = listTargetChapters({ scope });

  const [chapters, courseCompleted, durableChapterCompletionIds, rows] = await Promise.all([
    chaptersPromise,
    getTargetCourseCompletion({ scope }),
    listDurableChapterCompletionIds({ excludedLessonKinds, scope }),
    listPublishedLessonProgressRows({ excludedLessonKinds, scope }),
  ]);

  const after = getLastCompletedLessonAnchor({ rows });

  const state = getNextLessonState({
    after,
    courseCompleted,
    durableChapterCompletionIds,
    rows,
    scope,
  });

  return selectContinueLessonTarget({ chapters, scope, state });
}

/**
 * Continuation is optional catalog UI, so transient query failures become its
 * existing null fallback outside every cached leaf instead of being persisted.
 */
export async function getContinueLessonTarget(input: CatalogTargetInput) {
  const { data } = await safeAsync(() => loadContinueLessonTarget(input));
  return data ?? null;
}

/**
 * Derives the quiet current-item shortcut from the same current-user
 * continuation pipeline used by the catalog's primary action.
 */
export async function getActiveCatalogTarget(
  input: CatalogTargetInput,
): Promise<ActiveCatalogTarget | null> {
  const target = await getContinueLessonTarget(input);
  return toActiveCatalogTarget(target);
}
