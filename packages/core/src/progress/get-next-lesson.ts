import "server-only";
import { type LessonKind } from "@zoonk/db";
import { getChapterById } from "../chapters/get-chapter-by-id";
import { getCourseById } from "../courses/get-course-by-id";
import { getLessonById } from "../lessons/get-lesson-by-id";
import { type LessonScope } from "../lessons/lesson-scope";
import { getLessonVisibility } from "../users/lesson-visibility";
import { getProgressSession, tagProgressScope } from "./_utils/progress-cache";
import {
  type ActiveCatalogTarget,
  type ContinueTarget,
  getContinueLessonTarget,
  toActiveCatalogTarget,
} from "./get-continue-lesson-target";
import { getLastCompletedLessonAnchor, getNextLessonState } from "./get-next-lesson-state";
import {
  type PublishedCourseChapter,
  hasDurableCourseCompletion,
  listDurableChapterCompletionIds,
  listPublishedCourseChapters,
  listPublishedLessonProgressRows,
} from "./progress-queries";

export type ActiveLessonTarget = ActiveCatalogTarget;
export type NextLesson = ContinueTarget;

type NextLessonInput = { excludedLessonKinds?: LessonKind[]; scope: LessonScope };

/**
 * Resolves whether a progress scope belongs to the published brand catalog.
 * Resource handlers use this independent result to distinguish an unavailable
 * resource from a valid course or chapter that simply has no lesson target.
 */
async function getPublicProgressScope(scope: LessonScope) {
  if ("courseId" in scope) {
    return getCourseById({ courseId: scope.courseId });
  }

  if ("chapterId" in scope) {
    return getChapterById({ chapterId: scope.chapterId });
  }

  return getLessonById({ lessonId: scope.lessonId });
}

/**
 * Course continuation can advance into a later empty chapter. Other scopes do
 * not need the course outline.
 */
function listTargetChapters({ scope }: { scope: LessonScope }): Promise<PublishedCourseChapter[]> {
  if (!("courseId" in scope)) {
    return Promise.resolve([]);
  }

  return listPublishedCourseChapters({ courseId: scope.courseId });
}

/**
 * Durable course completion only participates in course-scope continuation.
 */
function getTargetCourseCompletion({
  scope,
  userId,
}: {
  scope: LessonScope;
  userId: string | null;
}) {
  if (!("courseId" in scope)) {
    return Promise.resolve(false);
  }

  return hasDurableCourseCompletion({ courseId: scope.courseId, userId });
}

/**
 * Resolves the next lesson or pending chapter from trusted session progress and
 * the published curriculum. Guests receive the same first public lesson target
 * without being able to choose an acting user.
 */
export async function getNextLesson({
  excludedLessonKinds,
  scope,
}: NextLessonInput): Promise<NextLesson | null> {
  "use cache: private";

  tagProgressScope(scope);

  const [session, visibility] = await Promise.all([
    getProgressSession(),
    excludedLessonKinds ? Promise.resolve(null) : getLessonVisibility(),
  ]);

  const userId = session?.user.id ?? null;
  const resolvedExcludedLessonKinds = excludedLessonKinds ?? visibility?.hiddenLessonKinds ?? [];

  const [chapters, courseCompleted, durableChapterCompletionIds, rows] = await Promise.all([
    listTargetChapters({ scope }),
    getTargetCourseCompletion({ scope, userId }),
    listDurableChapterCompletionIds({
      excludedLessonKinds: resolvedExcludedLessonKinds,
      scope,
      userId,
    }),
    listPublishedLessonProgressRows({
      excludedLessonKinds: resolvedExcludedLessonKinds,
      scope,
      userId,
    }),
  ]);

  const state = getNextLessonState({
    after: getLastCompletedLessonAnchor({ rows }),
    courseCompleted,
    durableChapterCompletionIds,
    rows,
    scope,
  });

  return getContinueLessonTarget({ chapters, scope, state });
}

/**
 * Returns the public next-learning resource with an explicit availability
 * outcome. A null target is still a successful resource when the published
 * course or chapter exists but has no visible lessons.
 */
export async function getNextLessonResource({ scope }: { scope: LessonScope }) {
  const [resource, target] = await Promise.all([
    getPublicProgressScope(scope),
    getNextLesson({ scope }),
  ]);

  if (!resource) {
    return { status: "notFound" as const };
  }

  return { status: "ready" as const, target };
}

/**
 * Returns only the current chapter or lesson shortcut used by catalog lists.
 */
export async function getActiveLessonTarget(
  input: NextLessonInput,
): Promise<ActiveLessonTarget | null> {
  "use cache: private";

  tagProgressScope(input.scope);
  return toActiveCatalogTarget(await getNextLesson(input));
}
