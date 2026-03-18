import { prisma } from "@zoonk/db";
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
  chapterSlug: string;
  courseSlug: string;
  lessonSlug: string;
};

type ChapterResult = {
  brandSlug: string;
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
      where: {
        OR: [
          {
            chapter: { id: scope.chapterId },
            position: { gt: scope.lessonPosition },
          },
          {
            chapter: { position: { gt: scope.chapterPosition } },
          },
        ],
        chapter: {
          course: { id: scope.courseId },
          isPublished: true,
        },
        isPublished: true,
      },
    }),
  );

  if (error || !lesson) {
    return null;
  }

  return {
    brandSlug: lesson.chapter.course.organization?.slug ?? "",
    chapterSlug: lesson.chapter.slug,
    courseSlug: lesson.chapter.course.slug,
    lessonSlug: lesson.slug,
  };
}

async function getNextChapterSibling(scope: ChapterScope): Promise<ChapterResult | null> {
  const { data: chapter, error } = await safeAsync(() =>
    prisma.chapter.findFirst({
      include: {
        course: { include: { organization: true } },
      },
      orderBy: { position: "asc" },
      where: {
        courseId: scope.courseId,
        isPublished: true,
        position: { gt: scope.chapterPosition },
      },
    }),
  );

  if (error || !chapter) {
    return null;
  }

  return {
    brandSlug: chapter.course.organization?.slug ?? "",
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
