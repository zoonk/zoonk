import "server-only";
import { prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { hasActiveSubscription } from "../../auth/subscription";
import { getReadableLessonWhere } from "../../lessons/read-access";

/**
 * Tutor generation is a subscriber capability even when the underlying lesson is free, while
 * publication and ownership checks still follow the lesson's live readable scope.
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

  const [lesson, hasSubscription] = await Promise.all([
    prisma.lesson.findFirst({
      include: { chapter: { include: { course: true } } },
      where: getReadableLessonWhere({ lessonId, userId }),
    }),
    hasActiveSubscription(),
  ]);

  if (!lesson || lesson.generationStatus !== "completed") {
    return { status: "notFound" as const };
  }

  return hasSubscription
    ? { lesson, status: "ready" as const }
    : { status: "subscriptionRequired" as const };
}

export type LessonQuestionAccessLesson = Extract<
  Awaited<ReturnType<typeof getLessonQuestionAccess>>,
  { status: "ready" }
>["lesson"];
