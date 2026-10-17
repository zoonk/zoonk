import "server-only";
import { prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { libraryRowsVisibleTo } from "../../library/_utils/library-visibility";

/** Library lessons the learner may play: public ones and their own, with their content written. */
function findLibraryLesson({ lessonId, userId }: { lessonId: string; userId: string }) {
  return prisma.lesson.findFirst({
    include: { homeChapter: { include: { homeCourse: true } } },
    omit: { spec: true, summary: true },
    where: { ...libraryRowsVisibleTo(userId), contentStatus: "completed", id: lessonId },
  });
}

export type LibraryQuestionLesson = NonNullable<Awaited<ReturnType<typeof findLibraryLesson>>>;

type LessonQuestionAccess =
  | { status: "notFound" }
  | { lesson: LibraryQuestionLesson; status: "ready" };

/**
 * Authenticated learners can ask about lessons available to them. Publication and ownership are
 * re-evaluated for every question operation; the tutor's allowance is claimed per answer.
 */
export async function getLessonQuestionAccess({
  lessonId,
  userId,
}: {
  lessonId: string;
  userId: string;
}): Promise<LessonQuestionAccess> {
  if (!isUuid(lessonId)) {
    return { status: "notFound" };
  }

  const lesson = await findLibraryLesson({ lessonId, userId });

  return lesson ? { lesson, status: "ready" } : { status: "notFound" };
}
