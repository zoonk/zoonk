import "server-only";
import { prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { getReadableLessonWhere } from "../../lessons/read-access";

/**
 * Authenticated learners can ask about lessons available to their current plan. Publication,
 * ownership, and generation readiness are re-evaluated for every question operation.
 */
export async function getLessonQuestionAccess({
  lessonId,
  userId,
}: {
  lessonId: string;
  userId: string;
}) {
  if (!isUuid(lessonId)) {
    return { status: "notFound" as const };
  }

  const lesson = await prisma.lesson.findFirst({
    include: { chapter: { include: { course: true } } },
    where: getReadableLessonWhere({ lessonId, userId }),
  });

  if (!lesson || lesson.generationStatus !== "completed") {
    return { status: "notFound" as const };
  }

  return { lesson, status: "ready" as const };
}

export type LessonQuestionAccessLesson = Extract<
  Awaited<ReturnType<typeof getLessonQuestionAccess>>,
  { status: "ready" }
>["lesson"];
