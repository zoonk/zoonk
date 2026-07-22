import "server-only";
import { type GenerationStatus, type LessonKind, getPublishedLessonWhere, prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { type LessonKindExclusion, getLessonKindExclusionWhere } from "./lesson-kind-exclusions";

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

/**
 * Finds the next published lesson in course order using structural position.
 */
export async function getNextLessonInCourse(params: {
  chapterId: string;
  chapterPosition: number;
  courseId: string;
  excludedLessonKinds?: LessonKindExclusion["excludedLessonKinds"];
  lessonPosition: number;
}): Promise<NextLessonInCourse | null> {
  if (!isUuid(params.chapterId) || !isUuid(params.courseId)) {
    return null;
  }

  const lesson = await prisma.lesson.findFirst({
    include: { chapter: true },
    orderBy: [{ chapter: { position: "asc" } }, { position: "asc" }],
    where: getPublishedLessonWhere({
      courseWhere: { id: params.courseId },
      lessonWhere: {
        ...getLessonKindExclusionWhere({ excludedLessonKinds: params.excludedLessonKinds }),
        OR: [
          { chapter: { id: params.chapterId }, position: { gt: params.lessonPosition } },
          { chapter: { position: { gt: params.chapterPosition } } },
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
