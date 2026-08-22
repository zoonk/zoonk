import "server-only";
import { prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { hasActiveSubscription } from "../../auth/subscription";
import { getLessonAccessRequirement } from "../../lessons/access";
import { getReadableLessonWhere } from "../../lessons/read-access";

/**
 * Question creation and retrieval are lesson capabilities, so their live write/read
 * authorization follows the same publication, ownership, and chapter paywall rules as the player.
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

  if (getLessonAccessRequirement({ lesson }) === "free") {
    return { lesson, status: "ready" as const };
  }

  return (await hasActiveSubscription())
    ? { lesson, status: "ready" as const }
    : { status: "subscriptionRequired" as const };
}

export type LessonQuestionAccessLesson = Extract<
  Awaited<ReturnType<typeof getLessonQuestionAccess>>,
  { status: "ready" }
>["lesson"];
