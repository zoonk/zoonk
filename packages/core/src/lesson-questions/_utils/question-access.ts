import "server-only";
import { prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { libraryRowsVisibleTo } from "../../library/_utils/library-visibility";

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

/** Recheck publication and ownership for every operation; claim tutor allowance per answer. */
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
