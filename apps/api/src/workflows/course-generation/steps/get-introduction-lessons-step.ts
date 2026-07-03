import { type Lesson, prisma } from "@zoonk/db";

/**
 * Loads the already-persisted intro lesson rows during retry and resume paths.
 * Without this step, a workflow that resumes after saving lessons would know
 * the chapter exists but would not know which first lesson path should complete
 * the generate-page stream.
 */
export async function getIntroductionLessonsStep(chapterId: string): Promise<Lesson[]> {
  "use step";

  return prisma.lesson.findMany({
    orderBy: { position: "asc" },
    where: { chapterId, isPublished: true },
  });
}

/**
 * Loads the intro lesson rows when retry logic only has the course context.
 * The position-zero chapter is the generated field-guide intro for regular
 * courses, and its position-zero lesson is the readiness boundary for redirect.
 */
export async function getCourseIntroductionLessonsStep(courseId: string): Promise<Lesson[]> {
  "use step";

  return prisma.lesson.findMany({
    orderBy: { position: "asc" },
    where: { chapter: { courseId, position: 0 }, isPublished: true },
  });
}
