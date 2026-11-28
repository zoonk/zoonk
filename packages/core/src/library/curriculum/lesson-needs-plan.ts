import "server-only";
import { prisma } from "@zoonk/db";
import { isSecondTakeIdentityKey } from "../second-takes/second-take-identity";

/**
 * A language lesson's writer builds its screens from the lesson's title and can-do, so it's planned
 * only as a second take, whose plan gives it a name and angle of its own.
 */
export async function lessonNeedsPlan(lessonId: string): Promise<boolean> {
  const lesson = await prisma.lesson.findUnique({
    select: { identityKey: true, targetLanguage: true },
    where: { id: lessonId },
  });

  return !lesson?.targetLanguage || isSecondTakeIdentityKey(lesson.identityKey);
}
