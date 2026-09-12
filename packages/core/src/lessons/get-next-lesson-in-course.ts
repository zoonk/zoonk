import "server-only";
import { type GenerationStatus, type LessonKind, prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { cacheTag } from "next/cache";
import { getCourseCurriculumCacheTag } from "../cache/tags";
import { getCourseById } from "../courses/get-course-by-id";
import {
  type LearningPathScope,
  getLearningPathScope,
} from "../progress/_utils/learning-path-scope";
import { getSession } from "../users/get-session";
import { type LessonKindExclusion } from "./lesson-kind-exclusions";
import { getPublishedLessonsAfter } from "./ordered-course-lessons";
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
  view?: "path" | "curriculum";
  courseId: string;
  excludedLessonKinds?: LessonKindExclusion["excludedLessonKinds"];
  lessonId: string;
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

  if (!isUuid(input.courseId) || !isUuid(input.lessonId)) {
    return null;
  }

  const lessons = await getPublishedLessonsAfter({
    courseId: input.courseId,
    excludedLessonKinds: input.excludedLessonKinds,
    lessonId: input.lessonId,
  });

  const lesson = lessons?.at(0);

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

/** Optional activities continue from their teaching source, including appended on-demand shells. */
async function getPathAnchor(input: NextLessonInCourseInput, path: LearningPathScope) {
  if (
    path.chapters.some((chapter) => chapter.lessons.some((lesson) => lesson.id === input.lessonId))
  ) {
    return input.lessonId;
  }

  const current = await prisma.lesson.findFirst({
    where: { chapter: { courseId: input.courseId }, id: input.lessonId, isPublished: true },
  });

  if (!current) {
    return null;
  }

  if (
    current.sourceLessonId &&
    path.chapters.some((chapter) =>
      chapter.lessons.some((lesson) => lesson.id === current.sourceLessonId),
    )
  ) {
    return current.sourceLessonId;
  }

  return (
    path.chapters
      .find((chapter) => chapter.id === current.chapterId)
      ?.lessons.findLast((lesson) => lesson.position < current.position)?.id ?? null
  );
}

/** An explicitly opened chapter can be outside the saved path, including guest level choices. */
async function getContinuationScope(input: NextLessonInCourseInput, path: LearningPathScope) {
  const anchor = await getPathAnchor(input, path);

  if (anchor) {
    return { anchor, path };
  }

  const current = await prisma.lesson.findFirst({
    select: { chapterId: true },
    where: { chapter: { courseId: input.courseId }, id: input.lessonId, isPublished: true },
  });

  if (!current) {
    return null;
  }

  const chapterPath = await getLearningPathScope({
    chapterId: current.chapterId,
    includeCoursePath: true,
  });

  if (!chapterPath) {
    return null;
  }

  const chapterAnchor = await getPathAnchor(input, chapterPath);
  return chapterAnchor ? { anchor: chapterAnchor, path: chapterPath } : null;
}

/**
 * Finds the next published lesson after a stable lesson ID. Visibility
 * exclusions are normalized before crossing the cached boundary.
 */
export async function getNextLessonInCourse(
  input: NextLessonInCourseInput,
): Promise<NextLessonInCourse | null> {
  if (!isUuid(input.courseId) || !isUuid(input.lessonId)) {
    return null;
  }

  if (input.view === "curriculum") {
    const course = await getCourseById({ courseId: input.courseId });
    return course ? getCachedNextLessonInCourse(normalizeNextLessonInput(input)) : null;
  }

  const path = await getLearningPathScope({ courseId: input.courseId });

  if (path !== undefined) {
    if (!path) {
      return null;
    }

    const continuation = await getContinuationScope(input, path);

    if (!continuation) {
      return null;
    }

    const { anchor } = continuation;
    const chapters = continuation.path.chapters;

    const currentChapter = chapters.findIndex((chapter) =>
      chapter.lessons.some((lesson) => lesson.id === anchor),
    );

    for (const chapter of chapters.slice(currentChapter)) {
      if (chapter.lessons.length === 0) {
        return null;
      }

      const currentLesson = chapter.lessons.findIndex((lesson) => lesson.id === anchor);

      const lesson = chapter.lessons
        .slice(currentLesson + 1)
        .find((candidate) => !input.excludedLessonKinds?.includes(candidate.kind));

      if (lesson) {
        return {
          chapterId: chapter.id,
          chapterPosition: chapter.position,
          chapterSlug: chapter.slug,
          chapterTitle: chapter.title,
          lessonDescription: lesson.description,
          lessonGenerationStatus: lesson.generationStatus,
          lessonId: lesson.id,
          lessonKind: lesson.kind,
          lessonPosition: lesson.position,
          lessonSlug: lesson.slug,
          lessonTitle: lesson.title,
        };
      }
    }

    return null;
  }

  return getCachedNextLessonInCourse(normalizeNextLessonInput(input));
}

/**
 * Resolves the structural successor of one published lesson using only its
 * stable resource ID. API and native callers should not have to know the
 * current chapter/course positions that the lower-level ordered lookup needs.
 */
export async function getNextLessonAfter({
  lessonId,
  view,
}: {
  lessonId: string;
  view?: "path" | "curriculum";
}) {
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
    courseId: lesson.chapter.courseId,
    lessonId: lesson.id,
    view,
  });

  return { lesson: nextLesson, status: "ready" as const };
}
