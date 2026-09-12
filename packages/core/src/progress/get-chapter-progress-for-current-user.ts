import "server-only";
import { type LessonKind } from "@zoonk/db";
import { getChapterById } from "../chapters/get-chapter-by-id";
import { getSession } from "../users/get-session";
import { getLessonVisibility } from "../users/lesson-visibility";
import { getLearningPathPercent, getLearningPathScope } from "./_utils/learning-path-scope";
import { getProgressSession, tagProgressScope } from "./_utils/progress-cache";
import { calculateProgressPercent } from "./calculate-continue-progress";
import { getLessonProgress as calculateLessonProgress } from "./get-lesson-progress";
import { listPublishedLessonProgressRows } from "./progress-queries";

/**
 * Loads detailed and aggregate chapter progress from the same visible lesson
 * rows so clients never receive a percentage computed from a different lesson
 * filter than the list they render.
 */
async function loadChapterProgress({
  chapterId,
  excludedLessonKinds,
  userId,
}: {
  chapterId: string;
  excludedLessonKinds: LessonKind[];
  userId: string | null;
}) {
  const scope = { chapterId } as const;

  if (!userId) {
    return { lessons: [], percentComplete: null };
  }

  const path = await getLearningPathScope(scope);

  if (path !== undefined) {
    return {
      lessons:
        path?.chapters.flatMap((chapter) =>
          chapter.lessons.map(({ id, isCompleted }) => ({ isCompleted, lessonId: id })),
        ) ?? [],
      percentComplete: path ? getLearningPathPercent(path) : null,
    };
  }

  const rows = await listPublishedLessonProgressRows({ excludedLessonKinds, scope, userId });

  const lessons = calculateLessonProgress({ rows });
  const completedItems = lessons.filter((lesson) => lesson.isCompleted).length;

  return {
    lessons,
    percentComplete: calculateProgressPercent({ completedItems, totalItems: lessons.length }),
  };
}

/**
 * Returns lesson-level progress for the authenticated learner. Authentication
 * remains inside core so callers cannot select another user's completion rows.
 */
export async function getChapterProgress({
  chapterId,
  excludedLessonKinds = [],
}: {
  chapterId: string;
  excludedLessonKinds?: LessonKind[];
}) {
  "use cache: private";

  tagProgressScope({ chapterId });

  const session = await getProgressSession();

  const progress = await loadChapterProgress({
    chapterId,
    excludedLessonKinds,
    userId: session?.user.id ?? null,
  });

  return progress.lessons;
}

/**
 * Returns the complete chapter progress API resource using the authenticated
 * learner's saved lesson visibility within Core.
 */
export async function getChapterProgressResource({ chapterId }: { chapterId: string }) {
  const [chapter, session, { hiddenLessonKinds }] = await Promise.all([
    getChapterById({ chapterId }),
    getSession(),
    getLessonVisibility(),
  ]);

  if (!chapter) {
    return null;
  }

  return loadChapterProgress({
    chapterId,
    excludedLessonKinds: hiddenLessonKinds,
    userId: session?.user.id ?? null,
  });
}
