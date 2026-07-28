import "server-only";
import { type GenerationStatus, type LessonKind, getPublishedLessonWhere, prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { cacheTag } from "next/cache";
import { getCourseCurriculumCacheTag } from "../cache/tags";
import { getSession } from "../users/get-session";
import { type LessonKindExclusion, getLessonKindExclusionWhere } from "./lesson-kind-exclusions";
import { getReadableLessonWhere } from "./read-access";

export type NextLessonInCourse = {
  lessonId: string;
  lessonKind: LessonKind;
  lessonPosition: number;
  lessonTitle: string | null;
  chapterId: string;
  chapterPosition: number;
  chapterSlug: string;
  chapterTitle: string;
  lessonDescription: string | null;
  lessonGenerationStatus: GenerationStatus;
  lessonSlug: string;
};

type NextLessonInCourseInput = {
  chapterId: string;
  chapterPosition: number;
  courseId: string;
  excludedLessonKinds?: LessonKindExclusion["excludedLessonKinds"];
  lessonPosition: number;
};

/**
 * Normalizes unordered lesson-kind exclusions so set-equivalent requests share
 * one structural cache entry.
 */
function normalizeNextLessonInput(input: NextLessonInCourseInput): NextLessonInCourseInput {
  return { ...input, excludedLessonKinds: [...new Set(input.excludedLessonKinds)].toSorted() };
}

/** Caches one structural next-lesson lookup until its course curriculum changes. */
async function getCachedNextLessonInCourse(
  input: NextLessonInCourseInput,
): Promise<NextLessonInCourse | null> {
  "use cache";
  cacheTag(getCourseCurriculumCacheTag(input.courseId));

  if (!isUuid(input.chapterId) || !isUuid(input.courseId)) {
    return null;
  }

  const lesson = await prisma.lesson.findFirst({
    include: { chapter: true },
    orderBy: [{ chapter: { position: "asc" } }, { position: "asc" }],
    where: getPublishedLessonWhere({
      courseWhere: { id: input.courseId },
      lessonWhere: {
        ...getLessonKindExclusionWhere({ excludedLessonKinds: input.excludedLessonKinds }),
        OR: [
          { chapter: { id: input.chapterId }, position: { gt: input.lessonPosition } },
          { chapter: { position: { gt: input.chapterPosition } } },
        ],
      },
    }),
  });

  if (!lesson) {
    return null;
  }

  return {
    chapterId: lesson.chapter.id,
    chapterPosition: lesson.chapter.position,
    chapterSlug: lesson.chapter.slug,
    chapterTitle: lesson.chapter.title,
    lessonDescription: lesson.description,
    lessonGenerationStatus: lesson.generationStatus,
    lessonId: lesson.id,
    lessonKind: lesson.kind,
    lessonPosition: lesson.position,
    lessonSlug: lesson.slug,
    lessonTitle: lesson.title,
  };
}

/**
 * Finds the next published lesson in course order using structural position.
 * Visibility exclusions are normalized before crossing the cached boundary.
 */
export async function getNextLessonInCourse(
  input: NextLessonInCourseInput,
): Promise<NextLessonInCourse | null> {
  return getCachedNextLessonInCourse(normalizeNextLessonInput(input));
}

/**
 * Resolves the structural successor of one published lesson using only its
 * stable resource ID. API and native callers should not have to know the
 * current chapter/course positions that the lower-level ordered lookup needs.
 */
export async function getNextLessonAfter({ lessonId }: { lessonId: string }) {
  if (!isUuid(lessonId)) {
    return { status: "notFound" as const };
  }

  const session = await getSession();

  const lesson = await prisma.lesson.findFirst({
    include: { chapter: true },
    where: getReadableLessonWhere({ lessonId, userId: session?.user.id ?? null }),
  });

  if (!lesson) {
    return { status: "notFound" as const };
  }

  const nextLesson = await getNextLessonInCourse({
    chapterId: lesson.chapterId,
    chapterPosition: lesson.chapter.position,
    courseId: lesson.chapter.courseId,
    lessonPosition: lesson.position,
  });

  return { lesson: nextLesson, status: "ready" as const };
}
