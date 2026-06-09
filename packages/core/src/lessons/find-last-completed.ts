import "server-only";
import { getPublishedLessonWhere, prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { type LessonKindExclusion, getLessonKindExclusionWhere } from "./lesson-kind-exclusions";

export type LessonScope = { courseId: string } | { chapterId: string } | { lessonId: string };

type LastCompletedLesson = {
  chapterId: string;
  chapterPosition: number;
  chapterSlug: string;
  courseId: string;
  courseSlug: string;
  lessonId: string;
  lessonPosition: number;
  lessonSlug: string;
  orgSlug: string | null;
};

/**
 * Builds the published lesson filter for the requested curriculum scope.
 */
function getScopeLessonWhere({
  excludedLessonKinds,
  scope,
}: LessonKindExclusion & { scope: LessonScope }) {
  const lessonWhere = getLessonKindExclusionWhere({ excludedLessonKinds });

  if ("courseId" in scope) {
    return getPublishedLessonWhere({ courseWhere: { id: scope.courseId }, lessonWhere });
  }

  if ("chapterId" in scope) {
    return getPublishedLessonWhere({ chapterWhere: { id: scope.chapterId }, lessonWhere });
  }

  return getPublishedLessonWhere({ lessonWhere: { ...lessonWhere, id: scope.lessonId } });
}

/**
 * Finds the user's most recently completed lesson in a scope and returns the
 * position data needed to locate the next lesson in course order.
 */
export async function findLastCompleted(
  userId: string,
  scope: LessonScope,
  options: LessonKindExclusion = {},
): Promise<LastCompletedLesson | null> {
  const { data: progress, error } = await safeAsync(() =>
    prisma.lessonProgress.findFirst({
      include: {
        lesson: {
          include: { chapter: { include: { course: { include: { organization: true } } } } },
        },
      },
      orderBy: [
        { completedAt: "desc" },
        { lesson: { chapter: { position: "desc" } } },
        { lesson: { position: "desc" } },
      ],
      where: {
        completedAt: { not: null },
        lesson: getScopeLessonWhere({ excludedLessonKinds: options.excludedLessonKinds, scope }),
        userId,
      },
    }),
  );

  if (error || !progress) {
    return null;
  }

  const { lesson } = progress;
  const { chapter } = lesson;

  return {
    chapterId: chapter.id,
    chapterPosition: chapter.position,
    chapterSlug: chapter.slug,
    courseId: chapter.course.id,
    courseSlug: chapter.course.slug,
    lessonId: lesson.id,
    lessonPosition: lesson.position,
    lessonSlug: lesson.slug,
    orgSlug: chapter.course.organization?.slug ?? null,
  };
}
