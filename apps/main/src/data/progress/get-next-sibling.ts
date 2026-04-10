import { getPublishedChapterWhere, getPublishedLessonWhere, prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";

type LessonScope = {
  chapterId: number;
  chapterPosition: number;
  courseId: number;
  lessonPosition: number;
  level: "lesson";
};

type ChapterScope = {
  chapterPosition: number;
  courseId: number;
  level: "chapter";
};

type LessonResult = {
  brandSlug: string;
  chapterId: number;
  chapterSlug: string;
  courseSlug: string;
  lessonDescription: string;
  lessonId: number;
  lessonSlug: string;
  lessonTitle: string;
};

type ChapterResult = {
  brandSlug: string;
  chapterId: number;
  chapterSlug: string;
  courseSlug: string;
};

async function getNextLessonSibling(scope: LessonScope): Promise<LessonResult | null> {
  const { data: lesson, error } = await safeAsync(() =>
    prisma.lesson.findFirst({
      include: {
        chapter: {
          include: {
            course: { include: { organization: true } },
          },
        },
      },
      orderBy: [{ chapter: { position: "asc" } }, { position: "asc" }],
      where: getPublishedLessonWhere({
        courseWhere: { id: scope.courseId },
        lessonWhere: {
          OR: [
            {
              chapter: { id: scope.chapterId },
              position: { gt: scope.lessonPosition },
            },
            {
              chapter: { position: { gt: scope.chapterPosition } },
            },
          ],
        },
      }),
    }),
  );

  if (error || !lesson) {
    return null;
  }

  return {
    brandSlug: lesson.chapter.course.organization?.slug ?? "",
    chapterId: lesson.chapter.id,
    chapterSlug: lesson.chapter.slug,
    courseSlug: lesson.chapter.course.slug,
    lessonDescription: lesson.description,
    lessonId: lesson.id,
    lessonSlug: lesson.slug,
    lessonTitle: lesson.title,
  };
}

async function getNextChapterSibling(scope: ChapterScope): Promise<ChapterResult | null> {
  const { data: chapter, error } = await safeAsync(() =>
    prisma.chapter.findFirst({
      include: {
        course: { include: { organization: true } },
      },
      orderBy: { position: "asc" },
      where: getPublishedChapterWhere({
        chapterWhere: {
          courseId: scope.courseId,
          position: { gt: scope.chapterPosition },
        },
      }),
    }),
  );

  if (error || !chapter) {
    return null;
  }

  return {
    brandSlug: chapter.course.organization?.slug ?? "",
    chapterId: chapter.id,
    chapterSlug: chapter.slug,
    courseSlug: chapter.course.slug,
  };
}

export function getNextSibling(scope: LessonScope): Promise<LessonResult | null>;
export function getNextSibling(scope: ChapterScope): Promise<ChapterResult | null>;
export function getNextSibling(
  scope: LessonScope | ChapterScope,
): Promise<LessonResult | ChapterResult | null> {
  if (scope.level === "lesson") {
    return getNextLessonSibling(scope);
  }

  return getNextChapterSibling(scope);
}
