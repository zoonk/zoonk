import { type LessonGetPayload, prisma } from "@zoonk/db";
import { OPTIONAL_LESSON_KINDS } from "../courses/learning-plan-contract";

export type OrderedCourseLesson = LessonGetPayload<{ include: { chapter: true } }>;

/**
 * Trusted after the caller authorizes the course. Loads one published course order in a single database statement, locates the
 * current lesson by stable ID, and returns eligible successors. A concurrent
 * split is therefore observed wholly before or wholly after its position shift.
 */
export async function getPublishedLessonsAfter({
  courseId,
  excludedLessonKinds = [],
  lessonId,
}: {
  courseId: string;
  excludedLessonKinds?: OrderedCourseLesson["kind"][];
  lessonId: string;
}): Promise<OrderedCourseLesson[] | null> {
  const lessons = await prisma.lesson.findMany({
    include: { chapter: true },
    orderBy: [{ chapter: { position: "asc" } }, { position: "asc" }],
    where: {
      OR: [
        { chapter: { courseId }, id: lessonId },
        { chapter: { courseId, isPublished: true }, isPublished: true },
      ],
    },
  });

  const current = lessons.find((lesson) => lesson.id === lessonId);

  const currentLessonIndex = lessons.findIndex(
    (lesson) => lesson.id === (current?.sourceLessonId ?? lessonId),
  );

  if (currentLessonIndex === -1) {
    return null;
  }

  const excludedKinds = new Set([...excludedLessonKinds, ...OPTIONAL_LESSON_KINDS]);

  return lessons
    .slice(currentLessonIndex + 1)
    .filter((lesson) => !excludedKinds.has(lesson.kind) && lesson.sourceLessonId === null);
}
