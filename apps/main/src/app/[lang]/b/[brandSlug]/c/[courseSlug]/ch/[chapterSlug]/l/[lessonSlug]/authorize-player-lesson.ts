import "server-only";
import { hasActiveSubscription } from "@zoonk/core/auth/subscription";
import { getLessonAccessRequirement } from "@zoonk/core/lessons/access";
import { getPublishedLessonWhere, prisma } from "@zoonk/db";
import { headers } from "next/headers";

/**
 * Reloads and authorizes a player lesson at mutation time. Server Actions are
 * direct POST endpoints, so completion still needs current publication,
 * generation, and subscription checks before durable progress can be written.
 */
export async function getAuthorizedPlayerLesson(lessonId: string) {
  const reqHeaders = await headers();

  const lesson = await prisma.lesson.findFirst({
    include: { chapter: true },
    where: getPublishedLessonWhere({
      lessonWhere: { generationStatus: "completed", id: lessonId },
    }),
  });

  if (!lesson) {
    return null;
  }

  if (getLessonAccessRequirement({ lesson }) === "free") {
    return lesson;
  }

  return (await hasActiveSubscription(reqHeaders)) ? lesson : null;
}
