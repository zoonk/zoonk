import "server-only";
import { prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { hasActiveSubscription } from "../../auth/subscription";
import { getLessonAccessRequirement } from "../../lessons/access";
import { getReadableLessonWhere } from "../../lessons/read-access";

/**
 * Authenticated learners can ask about lessons available to their current plan. Publication,
 * ownership, and paid-chapter checks are re-evaluated for every question operation.
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

  if (
    getLessonAccessRequirement({ lesson }) === "subscription" &&
    !(await hasActiveSubscription())
  ) {
    return { status: "subscriptionRequired" as const };
  }

  return { lesson, status: "ready" as const };
}

export type LessonQuestionAccessLesson = Extract<
  Awaited<ReturnType<typeof getLessonQuestionAccess>>,
  { status: "ready" }
>["lesson"];
